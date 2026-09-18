import { useEffect, useState } from "react";
import { serverFeatures } from "../api.js";

// Is a billing/infra-dependent feature actually configured on the server?
// `/api/health` returns a `features` block ({ pro, squad, push }) precisely
// because a missing env var used to render a live-looking CTA that died on
// click. Fails open: an unreachable health check leaves the feature offered,
// which is the same as the behaviour before the check existed.
export function useServerFeature(name) {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    let live = true;
    serverFeatures().then(f => { if (live) setOk(f[name] !== false); });
    return () => { live = false; };
  }, [name]);
  return ok;
}
