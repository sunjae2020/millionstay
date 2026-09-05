/**
 * Browser page-translation (Chrome/Edge auto-translate, in-app browsers) replaces the text nodes
 * React is tracking. When React later removes or moves one of them it throws
 * "Failed to execute 'removeChild' on 'Node'" and the whole page unmounts — on Android Chrome
 * that looked like being thrown back out right after login.
 *
 * `index.html` opts out of translation (`translate="no"` + `<meta name="google" content="notranslate">`),
 * which stops it at the source. This is the safety net for browsers that translate anyway: the two
 * calls become no-ops when the node is no longer where React thinks it is, instead of throwing.
 */
export function installDomGuard() {
  if (typeof Node === "undefined") return;
  const proto = Node.prototype as any;
  if (proto.__msDomGuard) return;
  proto.__msDomGuard = true;

  const nativeRemoveChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      console.warn("[domGuard] removeChild on a re-parented node — ignored", child);
      return child;
    }
    return nativeRemoveChild.call(this, child) as T;
  };

  const nativeInsertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      console.warn("[domGuard] insertBefore with a re-parented reference — appended instead", node);
      return this.appendChild(node) as T;
    }
    return nativeInsertBefore.call(this, node, ref) as T;
  };
}
