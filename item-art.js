'use strict';
// Preserve the existing HUD API while using the exact supplied item artwork.
// CSS windows crop out the sheet labels; no generated substitute icons.
(() => {
 const cells={burst:[0,0],shield:[1,0],mine:[2,0],missile:[0,1],pulse:[1,1],triple:[2,1]};
 window.itemIconSVG=function(key){
  const cell=cells[key];if(!cell)return '';
  return `<span class="reference-item" role="img" aria-label="${ITEMS[key].name}" style="--item-x:${cell[0]};--item-y:${cell[1]}"></span>`;
 };
})();
