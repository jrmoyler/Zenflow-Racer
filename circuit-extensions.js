'use strict';
// Each detour replaces the east-side approach before rejoining the original
// control point 3. Original sections and the start/finish are retained.
const CIRCUIT_EXTENSIONS={
 cherry:{names:['Lantern Sweep','Sky Temple Hairpin','Cloudfall Bridge'],points:[[255,8,15],[340,20,-30],[405,34,-145],[365,40,-250],[290,28,-275],[205,12,-195]]},
 stormforge:{names:['Turbine Chicane','Foundry Drop','Reactor Exit'],points:[[265,10,20],[325,22,-30],[295,29,-100],[365,34,-175],[325,20,-265],[260,10,-245],[220,7,-180]]},
 canopy:{names:['Cliffside Sweep','Canopy Descent','Sea Bridge'],points:[[265,18,15],[335,36,-55],[395,42,-200],[335,30,-280],[250,16,-275],[210,12,-220]]}
};
function extendedCircuitControls(id,base){return [...base.slice(0,3),...CIRCUIT_EXTENSIONS[id].points.map(p=>p.slice()),...base.slice(3)];}
function extendedCircuitKeys(id,keys){const count=CIRCUIT_EXTENSIONS[id].points.length;return keys.map(([i,v])=>[i>=3?i+count:i,v]);}
