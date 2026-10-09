import { useState } from "react";
import { api } from "../api.js";
import { getDisplayName } from "./format.js";

/* Every notebook/class CRUD handler Scholr() used to own directly — moved
 * verbatim, not rewritten. State that JSX reads straight off Scholr() (classes,
 * notebooks, classUnitsCache, expandedClassId, confirmDeleteNb, …) stays
 * declared there and is passed in here as values + setters, so this file holds
 * only logic, never a second copy of the data. Two pieces of state live here
 * instead, because nothing outside this cluster touches them: `deletingNb`
 * (only the delete-confirm modal's disabled state reads it, which the caller
 * still gets back) and `syllabusClassId` (paired one-to-one with
 * openClassSyllabus).
 */
export function useNotebookActions({
  user, activeNb,
  notebooks, setNotebooks,
  classes, setClasses,
  classUnitsCache, setClassUnitsCache,
  expandedClassId, setExpandedClassId,
  setActiveNb, setActiveView,
  setToast, setShowMobileFriends,
  setConfirmDeleteNb,
  setUpgradeModal, setShowNewClassModal, setNewUnitFor,
  setSubscription,
}) {
  const [deletingNb, setDeletingNb] = useState(false);
  const [syllabusClassId, setSyllabusClassId] = useState(null);

  function patchNotebookEverywhere(notebookId, patch) {
    const apply = list => list.map(n => n.id === notebookId ? { ...n, ...patch } : n);
    setNotebooks(apply);
    setClassUnitsCache(prev => {
      const next = { ...prev };
      for (const cid of Object.keys(next)) {
        if (Array.isArray(next[cid])) next[cid] = apply(next[cid]);
      }
      return next;
    });
    setActiveNb(curr => curr && curr.id === notebookId ? { ...curr, ...patch } : curr);
  }

  // Remove notebook(s) from every place notebooks are stored: the list, the
  // per-class unit cache, and the currently-open notebook.
  // Deleting a notebook takes its notes with it, so this is only reached from
  // an explicit confirmation naming the notebook.
  async function handleDeleteNotebook(nb) {
    setDeletingNb(true);
    try {
      await api.deleteNotebook(nb.id);
      removeNotebooksByIds(new Set([nb.id]));
      setConfirmDeleteNb(null);
      setToast("Notebook deleted");
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      console.error("deleteNotebook failed:", err);
      setToast(err?.message || "Couldn't delete that notebook");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setDeletingNb(false);
    }
  }

  function removeNotebooksByIds(idSet) {
    if (!idSet || idSet.size === 0) return;
    const drop = list => list.filter(n => !idSet.has(n.id));
    setNotebooks(drop);
    setClassUnitsCache(prev => {
      const next = { ...prev };
      for (const cid of Object.keys(next)) {
        if (Array.isArray(next[cid])) next[cid] = next[cid].filter(u => !idSet.has(u.id));
      }
      return next;
    });
    setActiveNb(curr => (curr && idSet.has(curr.id) ? null : curr));
  }

  async function handleSetDueDate(nb, dueDate) {
    patchNotebookEverywhere(nb.id, { due_date: dueDate });
    try { await api.updateNotebookDueDate(nb.id, dueDate); }
    catch (err) { console.error(err); setToast({ text: "Couldn't update due date", tone: "error" }); setTimeout(() => setToast(""), 2500); }
  }

  async function handleSetAssessmentType(nb, assessmentType) {
    patchNotebookEverywhere(nb.id, { assessment_type: assessmentType });
    try { await api.updateNotebookAssessmentType(nb.id, assessmentType); }
    catch (err) { console.error(err); setToast({ text: "Couldn't update assessment type", tone: "error" }); setTimeout(() => setToast(""), 2500); }
  }

  // Open a notebook by id (from a notification). Look across loaded lists first;
  // if not found (e.g. just invited, not yet in the list), refresh and retry.
  async function openNotebookById(notebookId) {
    setShowMobileFriends(false);
    const found = notebooks.find(n => n.id === notebookId);
    if (found) { setActiveNb(found); setActiveView("dashboard"); return; }
    try {
      const all = await api.listNotebooks(getDisplayName(user));
      setNotebooks(all);
      const nb = all.find(n => n.id === notebookId);
      if (nb) { setActiveNb(nb); setActiveView("dashboard"); }
      else { setActiveView("units"); }
    } catch { setActiveView("units"); }
  }

  async function handleToggleClass(classId) {
    if (expandedClassId === classId) { setExpandedClassId(null); return; }
    setExpandedClassId(classId);
    if (classUnitsCache[classId]) return;
    setClassUnitsCache(prev => ({ ...prev, [classId]: null }));
    try {
      const units = await api.listClassNotebooks(classId, getDisplayName(user));
      setClassUnitsCache(prev => ({ ...prev, [classId]: units }));
    } catch {
      setClassUnitsCache(prev => ({ ...prev, [classId]: [] }));
    }
  }

  // "Click a class, see the whole syllabus" — reuses the same units cache the
  // inline expand uses, so opening the syllabus view for an already-expanded
  // class is instant, and expanding it afterward doesn't re-fetch either.
  async function openClassSyllabus(classId) {
    setSyllabusClassId(classId);
    if (classUnitsCache[classId]) return;
    setClassUnitsCache(prev => ({ ...prev, [classId]: null }));
    try {
      const units = await api.listClassNotebooks(classId, getDisplayName(user));
      setClassUnitsCache(prev => ({ ...prev, [classId]: units }));
    } catch {
      setClassUnitsCache(prev => ({ ...prev, [classId]: [] }));
    }
  }

  async function handleCreateClass(title, color, template) {
    try {
      const cls = await api.createClass(title, color);
      setClasses(prev => [...prev, cls]);
      // Template selected → batch-create its notebooks + starter notes, open the first.
      if (template && template.id !== "blank" && template.notebooks?.length) {
        try {
          const result = await api.applyTemplate(cls.id, template.notebooks);
          const nm = getDisplayName(user);
          api.listNotebooks(nm).then(setNotebooks).catch(() => {});
          api.listClasses().then(setClasses).catch(() => {});
          if (result.firstNotebookId) {
            const units = await api.listClassNotebooks(cls.id, nm).catch(() => []);
            const first = units.find(u => u.id === result.firstNotebookId) || units[0];
            if (first) { setActiveNb(first); setActiveView("dashboard"); }
          }
          if (result.limitHit) {
            setToast("Some notebooks weren't added — you've hit the free plan limit.");
            setTimeout(() => setToast(""), 4500);
          }
        } catch (e) {
          console.error("applyTemplate failed:", e);
          setToast({ text: "Class created, but template setup failed.", tone: "error" });
          setTimeout(() => setToast(""), 3500);
        }
      }
    } catch (err) {
      if (err.code === "class_limit_reached") {
        setShowNewClassModal(false);
        setUpgradeModal({ limitType: "class_limit_reached" });
        return;
      }
      throw err;
    }
  }

  // Same underlying flow as handleCreateClass's template branch — a syllabus
  // is just a template the user didn't have to hand-type, extracted by
  // SyllabusImportModal and reviewed before this ever runs.
  async function handleImportSyllabus(className, notebooks) {
    const cls = await api.createClass(className);
    setClasses(prev => [...prev, cls]);
    try {
      const result = await api.applyTemplate(cls.id, notebooks, { fromSyllabus: true });
      const nm = getDisplayName(user);
      api.listNotebooks(nm).then(setNotebooks).catch(() => {});
      api.listClasses().then(setClasses).catch(() => {});
      if (result.firstNotebookId) {
        const units = await api.listClassNotebooks(cls.id, nm).catch(() => []);
        const first = units.find(u => u.id === result.firstNotebookId) || units[0];
        if (first) { setActiveNb(first); setActiveView("dashboard"); }
      }
      if (result.limitHit) {
        setToast("Some units weren't added — you've hit the free plan limit.");
        setTimeout(() => setToast(""), 4500);
      }
    } catch (e) {
      console.error("syllabus applyTemplate failed:", e);
      throw new Error("Class created, but adding the units failed.", { cause: e });
    }
  }

  // Importing into a class that already exists: the same parse-and-review the
  // dashboard import uses, minus createClass — the syllabus only supplies the
  // units. Refreshes the open card's cached units so they appear in place
  // rather than after a collapse/expand.
  async function handleImportSyllabusIntoClass(cls, notebooksToAdd) {
    const result = await api.applyTemplate(cls.id, notebooksToAdd, { fromSyllabus: true });
    const nm = getDisplayName(user);
    api.listNotebooks(nm).then(setNotebooks).catch(() => {});
    api.listClasses().then(setClasses).catch(() => {});
    const units = await api.listClassNotebooks(cls.id, nm).catch(() => null);
    if (units) setClassUnitsCache(prev => ({ ...prev, [cls.id]: units }));
    setToast(result.limitHit
      ? "Some units weren't added — you've hit the free plan limit."
      : `Added ${result.created} unit${result.created === 1 ? "" : "s"} to ${cls.title}`);
    setTimeout(() => setToast(""), 4500);
  }

  async function handleChangeClassColor(classId, color) {
    // Optimistic update so the UI feels snappy
    const prevClasses = classes;
    setClasses(cs => cs.map(c => c.id === classId ? { ...c, color } : c));
    try {
      await api.updateClassColor(classId, color);
    } catch (err) {
      console.error("updateClassColor failed:", err);
      setClasses(prevClasses);
      setToast({ text: "Could not update color", tone: "error" });
      setTimeout(() => setToast(""), 2500);
    }
  }

  // Takes the reordered array, not a drag event: the library lives behind a
  // lazy boundary and this side does not need to know it exists.
  async function handleReorderClasses(next) {
    const prev = classes;
    setClasses(next);                          // optimistic
    try {
      await api.reorderClasses(next.map(c => c.id));
    } catch (err) {
      console.error("reorderClasses failed:", err);
      setClasses(prev);                        // revert
      setToast({ text: "Could not reorder classes", tone: "error" });
      setTimeout(() => setToast(""), 2500);
    }
  }

  async function handleCreateUnit(classId, title, topic) {
    try {
      const unit = await api.createClassNotebook(classId, title, topic, getDisplayName(user));
      setClassUnitsCache(prev => ({ ...prev, [classId]: [...(prev[classId] ?? []), unit] }));
      setNotebooks(prev => [unit, ...prev]);
      setSubscription(prev => ({ ...prev, notebooksUsed: (prev.notebooksUsed ?? 0) + 1 }));
    } catch (err) {
      if (err.code === "notebook_limit_reached") {
        setNewUnitFor(null);
        setUpgradeModal({ limitType: "notebook_limit_reached" });
        return;
      }
      throw err;
    }
  }

  // When opening a unit from a class card, attach the class's color so
  // NotebookView/Forge can tint accordingly. Units opened from the Units list
  // fall back to the deterministic per-notebook tint.
  function openUnitWithClassColor(unit, classColor) {
    setActiveNb(classColor ? { ...unit, color: classColor } : unit);
  }

  async function handleDeleteClass(classId) {
    await api.deleteClass(classId);
    // The server cascades the class's notebooks → drop every one of them from
    // all client-side notebook state (list, cache, open notebook), not just
    // the class + its unit cache.
    const removed = new Set();
    for (const list of [notebooks, ...Object.values(classUnitsCache)]) {
      for (const n of (list || [])) if (n && n.class_id === classId) removed.add(n.id);
    }
    setClasses(prev => prev.filter(c => c.id !== classId));
    setClassUnitsCache(prev => { const next = { ...prev }; delete next[classId]; return next; });
    removeNotebooksByIds(removed);
    if (activeNb && removed.has(activeNb.id)) setActiveView("dashboard");
    if (expandedClassId === classId) setExpandedClassId(null);
    setToast("Class deleted");
    setTimeout(() => setToast(""), 3000);
  }

  return {
    deletingNb, syllabusClassId, setSyllabusClassId,
    patchNotebookEverywhere, removeNotebooksByIds, handleDeleteNotebook,
    handleSetDueDate, handleSetAssessmentType,
    openNotebookById, handleToggleClass, openClassSyllabus,
    handleCreateClass, handleImportSyllabus, handleImportSyllabusIntoClass,
    handleChangeClassColor, handleReorderClasses, handleCreateUnit,
    openUnitWithClassColor, handleDeleteClass,
  };
}
