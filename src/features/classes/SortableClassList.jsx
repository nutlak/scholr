import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ClassCard } from "./ClassCard.jsx";

/* Everything that needs dnd-kit, in one lazily-loaded module.
 *
 * dnd-kit is 1.5MB on disk and exists here to let you drag class cards into a
 * different order. It used to be imported at the top of App.jsx, and
 * SortableClassCard lived in ClassCard.jsx — which ClassModals.jsx imports for
 * ColorSwatchPicker, which App.jsx imports directly. So the whole library
 * landed in the entry chunk, and every visitor to the marketing page
 * downloaded a drag-and-drop engine before seeing a headline.
 *
 * Keeping the sortable wrapper in here rather than in ClassCard.jsx is what
 * actually breaks that chain: one module importing dnd-kit is enough to pull it
 * in, however conditionally the component is rendered.
 *
 * The reorder is reported as the finished array rather than a dnd-kit event,
 * so the caller never has to know this library exists.
 */

// Wraps ClassCard with dnd-kit sortable behavior. The drag listeners are bound
// to the handle (not the wrapper) so clicking the card body still opens it.
// While dragging: slight scale, drop shadow, lifted z-index.
function SortableClassCard({ cls, dragDisabled, ...rest }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: cls.id, disabled: dragDisabled });

  const scaled = isDragging && transform
    ? { ...transform, scaleX: 1.02, scaleY: 1.02 }
    : transform;

  const style = {
    position: "relative",
    transform: CSS.Transform.toString(scaled),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 10 : "auto",
    boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.35)" : "none",
    borderRadius: isDragging ? 6 : 0,
    background: isDragging ? "var(--bg-surface-1)" : "transparent",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-class-row${isDragging ? " is-dragging" : ""}`}
    >
      {!dragDisabled && (
        <button
          type="button"
          className="class-drag-handle"
          aria-label="Drag to reorder class"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      )}
      <ClassCard cls={cls} {...rest} />
    </div>
  );
}

export function SortableClassList({ classes, dragDisabled, onReorder, cardProps }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = classes.findIndex(c => c.id === active.id);
    const to = classes.findIndex(c => c.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(classes, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={classes.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 40 }}>
          {classes.map(cls => (
            <SortableClassCard
              key={cls.id}
              cls={cls}
              dragDisabled={dragDisabled}
              {...cardProps(cls)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
