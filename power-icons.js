/* Shared glyph set for signature powers and add-ons.
   One 24x24 grid, one 1.7px stroke weight, colour supplied by the host element
   through currentColor so a glyph reads correctly on the roster card, in the
   loadout catalog and on the in-race dock without a second asset. */
'use strict';
const POWER_GLYPH_BOX='0 0 24 24';
// Division signatures. Each mark states the mechanic, not the brand: a dilation
// field is a clock inside a ring, a phase walk is a body split from its echo.
const ABILITY_GLYPHS={
 zenflow:'<circle cx="12" cy="12" r="7.5"/><path d="M12 7.5V12l3 2.4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2"/>',
 collective:'<circle cx="12" cy="12" r="3.4"/><path d="M12 8.6V4.2M12 15.4v4.4M8.6 12H4.2M15.4 12h4.4"/><path d="m9.6 9.6-2.9-2.9M14.4 14.4l2.9 2.9M9.6 14.4l-2.9 2.9M14.4 9.6l2.9-2.9"/>',
 hybrid:'<path d="M9 4.5h4a7.5 7.5 0 0 1 0 15H9"/><path d="M6 4.5a7.5 7.5 0 0 0 0 15" stroke-dasharray="2.6 2.6"/>',
 nexus:'<rect x="4" y="6" width="16" height="12" rx="1.5" stroke-dasharray="3 2.4"/><path d="M12 9.5v5M9.5 12h5"/><path d="M8 21h8"/>',
 kinetic:'<path d="M4 12h7"/><path d="m11 6 6 6-6 6z"/><path d="M19.5 7v10"/>',
 juris:'<path d="M12 3.5 20 7v6.5c0 4.4-3.3 7.4-8 8.6-4.7-1.2-8-4.2-8-8.6V7z"/><path d="M12 3.5v18.6"/>',
 signal:'<path d="M3 12h6"/><path d="m9 8.5 8 3.5-8 3.5z"/><path d="M19 8.2a6 6 0 0 1 0 7.6M21.5 6a9.5 9.5 0 0 1 0 12"/>',
 loom:'<path d="M3.5 8c4 0 4 8 8.5 8s4.5-8 8.5-8"/><path d="M3.5 16c4 0 4-8 8.5-8s4.5 8 8.5 8"/>',
 vector:'<path d="M7 5v14"/><path d="M17 5v14"/><path d="M9.5 12h5"/><path d="m12.6 9.4 2.6 2.6-2.6 2.6"/>',
 aether:'<circle cx="12" cy="12" r="2.6"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2"/><ellipse cx="12" cy="12" rx="4.2" ry="9.5"/>',
 animus:'<circle cx="12" cy="9" r="3.4"/><path d="M12 12.4v3.2"/><path d="M4.5 6.5 9 9M19.5 6.5 15 9"/><path d="M8 19.5h8"/><path d="M12 15.6 9.5 19.5M12 15.6l2.5 3.9"/>',
 helix:'<path d="M8 3c0 6 8 6 8 12s-8 6-8 6"/><path d="M16 3c0 6-8 6-8 12s8 6 8 6"/><path d="M9 8h6M9 16h6"/>',
 ledger:'<rect x="4.5" y="10" width="15" height="10.5" rx="1.6"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.2" r="1.5"/>',
 terra:'<path d="M12 3.5v17"/><path d="M7.5 8h9"/><path d="M4.5 13a7.5 7.5 0 0 0 15 0"/>',
 obsidian:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m12 7.5 4.2 2.4v4.8L12 17.1l-4.2-2.4V9.9z"/>',
 civic:'<circle cx="8" cy="8.5" r="2.6"/><circle cx="16" cy="8.5" r="2.6"/><path d="M3.5 19.5c0-3 2-4.8 4.5-4.8s4.5 1.8 4.5 4.8"/><path d="M12.5 15.4c1-.5 2.2-.7 3.5-.7 2.5 0 4.5 1.8 4.5 4.8"/>',
 cognara:'<path d="M3.5 19.5C7 19.5 8 4.5 12.5 4.5S18 13 20.5 13" stroke-dasharray="3.4 2.6"/><circle cx="12.5" cy="4.5" r="1.8"/><circle cx="20.5" cy="13" r="1.8"/>',
 gaia:'<path d="M12 21V9"/><path d="M12 9c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6z"/><path d="M12 13.5c0-2.8-2.3-5-5-5 0 2.8 2.2 5 5 5z"/>',
 nomad:'<path d="M12 21s6.5-6.2 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.8 12 21 12 21z"/><circle cx="12" cy="10.2" r="2.4"/>',
 eon:'<path d="M3.5 9h9.5a3.2 3.2 0 1 0-3.2-3.2"/><path d="M3.5 14h13a3.4 3.4 0 1 1-3.4 3.4"/>',
};
// Add-on marks are keyed by behaviour, so a driver learns one language for the
// whole catalog: rings gate, projectiles travel, zones sit on the road.
const ADDON_TYPE_GLYPHS={
 'Guard':'<path d="M12 3.5 20 7v6.5c0 4.4-3.3 7.4-8 8.6-4.7-1.2-8-4.2-8-8.6V7z"/><path d="m8.7 12.4 2.4 2.4 4.2-4.6"/>',
 'Zone':'<ellipse cx="12" cy="15" rx="8.5" ry="4.5" stroke-dasharray="3 2.4"/><path d="M9.5 12.4c0-2 2.5-2.6 2.5-5.4 1.8 1.7 2.6 3.4 2.6 5.1"/>',
 'Summon':'<path d="M12 21v-7"/><path d="M12 14c-3.4 0-5.6-2.4-5.6-5.6C9.8 8.4 12 10.7 12 14z"/><path d="M12 14c0-3.6 2.3-6 5.8-6 0 3.3-2.3 6-5.8 6z"/><path d="M8 21h8"/>',
 'Projectile':'<path d="M3 12h7"/><path d="m10 7.5 8 4.5-8 4.5z"/><circle cx="20.4" cy="12" r="1.4"/>',
 'Pierce':'<path d="M2.5 12h19"/><path d="m8 8.4 3.4 3.6L8 15.6M14 8.4l3.4 3.6-3.4 3.6"/>',
 'Rupture':'<path d="M2.5 18h19"/><path d="m7 18 3-8 2.5 4.5L15 6l2.5 12"/>',
 'Vortex':'<path d="M12 12.2a3 3 0 1 1-2.4-2.9"/><path d="M12 5.4A6.8 6.8 0 1 0 18.6 12"/><path d="M12 1.8A10.2 10.2 0 1 1 1.8 12"/>',
 'Collapse':'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3.6M12 17.9v3.6M2.5 12h3.6M17.9 12h3.6"/><path d="m5.6 5.6 2.5 2.5M18.4 18.4l-2.5-2.5M5.6 18.4l2.5-2.5M18.4 5.6l-2.5 2.5"/>',
 'Volley':'<path d="M3 7h5l4 3M3 17h5l4-3"/><path d="m12 10 7 2-7 2z"/><path d="M12 12h9"/>',
 'Detonate':'<circle cx="12" cy="15.5" r="4.5" stroke-dasharray="2.6 2.2"/><path d="M12 2.5v8"/><path d="m8.6 6.5 3.4 4 3.4-4"/>',
 'Ring':'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.6"/>',
 'Slam':'<path d="M4.5 4.5c0 6 3 8 3 15"/><path d="M19.5 4.5c0 6-3 8-3 15"/><path d="M12 3.5v12"/><path d="M4.5 20.5h15"/>',
 'Chain':'<circle cx="12" cy="12" r="3"/><path d="M12 3.5 9 8.6l4.6.9L10.5 20"/><path d="M20.5 12h-5M3.5 12h5"/>',
 'Blockade':'<rect x="4" y="9" width="16" height="10.5" rx="1"/><path d="M4 14.2h16M9.4 9v10.5M14.6 9v10.5"/><path d="M12 3.5v4.4"/>',
 'Gate':'<path d="M5 20.5V9a7 7 0 0 1 14 0v11.5"/><path d="M9.5 20.5v-7"/><path d="M14.5 20.5v-7"/>',
 'Ring gate':'<ellipse cx="12" cy="12" rx="6" ry="8.5"/><path d="M3.5 12h17"/>',
 'Portal':'<ellipse cx="12" cy="12" rx="5" ry="8.5"/><ellipse cx="12" cy="12" rx="1.9" ry="4"/><path d="M17.6 6.5 21 4M17.6 17.5 21 20"/>',
 'Self buff':'<path d="m13.5 2.5-8 11h5.5l-2.5 8 8-11h-5.5z"/>',
 'Wave':'<path d="M2.5 8.5c3-3 5.5 3 8.5 0s5.5 3 8.5 0"/><path d="M2.5 14c3-3 5.5 3 8.5 0s5.5 3 8.5 0"/><path d="M2.5 19.5c3-3 5.5 3 8.5 0s5.5 3 8.5 0"/>',
 'Trail':'<path d="M20.5 5.5c-5 0-5 5-9 5"/><path d="M20.5 12c-7 0-7 6.5-13 6.5"/><path d="M4 8.5h2M4 14.5h3"/>',
};
// The empty slot is a real choice in the catalog, so it gets a mark of its own.
const POWER_GLYPH_EMPTY='<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2.6"/><path d="M9 12h6"/>';
const POWER_GLYPH_FALLBACK='<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M7.5 12h9"/>';
function powerGlyphSVG(body,label=''){
 return '<svg viewBox="'+POWER_GLYPH_BOX+'" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'+
  (label?' role="img" aria-label="'+label+'"':' aria-hidden="true"')+'>'+body+'</svg>';
}
function abilityIconSVG(divisionId,label=''){return powerGlyphSVG(ABILITY_GLYPHS[divisionId]||POWER_GLYPH_FALLBACK,label);}
function addonIconSVG(addon,label=''){return powerGlyphSVG(addon&&addon.id?(ADDON_TYPE_GLYPHS[addon.type]||POWER_GLYPH_FALLBACK):POWER_GLYPH_EMPTY,label);}
if(typeof module!=='undefined'&&module.exports)module.exports={ABILITY_GLYPHS,ADDON_TYPE_GLYPHS,POWER_GLYPH_EMPTY,abilityIconSVG,addonIconSVG,powerGlyphSVG};
