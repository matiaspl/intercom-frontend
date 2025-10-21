import { useEffect } from "react";
import { isMobileApp } from "../../platform";
// AudioRoute disabled for now

export const MobileInit = () => {
  useEffect(() => {
    if (!isMobileApp()) return;
    (async () => {
      // AudioRoute disabled: do not alter system route
    })();
  }, []);
  return null;
};
