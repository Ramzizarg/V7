/**
 * Inline script run before React hydrates.
 * Browser extensions (e.g. Bitwarden) inject attributes like `bis_skin_checked`
 * into the DOM after SSR HTML arrives, which causes hydration mismatches.
 */
export const HYDRATION_GUARD_SCRIPT = `(function(){var EXT=["bis_skin_checked","bis_register"];function strip(root){try{var w=document.createTreeWalker(root,1);for(var n;(n=w.nextNode());)for(var i=0;i<EXT.length;i++)n.removeAttribute(EXT[i])}catch(e){}}strip(document.documentElement);var obs=new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];if(m.type==="attributes"&&EXT.indexOf(m.attributeName)>-1)m.target.removeAttribute(m.attributeName)}});obs.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:EXT});document.addEventListener("DOMContentLoaded",function(){strip(document.documentElement)},{once:true})})();`;
