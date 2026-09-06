"""Author the kart animation clips as Blender Actions on the rig built by build-kart-rig-blender.py.

    blender --background .tools/zenflow-karts.blend --python tools/author-kart-clips.py -- .tools/zenflow-karts.blend

One slotted Action per clip (Blender 4.4+ "one action, many slots"): every keyed rig node gets a
slot named after its runtime node name, so tools/export-kart-clips.py can map f-curves back to
the runtime contract without depending on Blender object names. The clips are authored on the
ZenFlow reference kart and then assigned to all twelve karts (node names are shared), which is
what the review renders show.

Keys are written in the game's frame (Three: x right, y up, nose toward -z; metres/radians) and
converted to Blender's frame at keying time (see kartrig_common). Every key is a real Blender
keyframe with interpolation/easing/handle types, so the curves can be refined in the Graph Editor
and re-exported. Animation principles used: ease in/out (auto-clamped Bezier + SINE/QUAD easing),
anticipation before the main action (boost squat, hit nod), overshoot (BACK easing), settle,
secondary motion (pilot/head/arms lag the chassis), and seamless loops (first key == last key,
CYCLES modifier).
"""
import bpy, json, sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kartrig_common import FPS, CLIP_NAMES, ANIMATABLE_NODES, find_node, assign_clip

args = sys.argv[sys.argv.index('--') + 1:]
target = os.path.abspath(args[0])
REFERENCE = 'zenflow'
scene = bpy.context.scene
scene.render.fps = FPS

# ---------------------------------------------------------------- key DSL
CHANNEL = {'pos': 'location', 'rot': 'rotation_euler', 'scale': 'scale'}
# Three axis -> (Blender array index, sign) per channel type.
AXIS = {
    'pos': {'x': (0, 1), 'y': (2, 1), 'z': (1, -1)},
    'rot': {'x': (0, 1), 'y': (2, 1), 'z': (1, -1)},
    'scale': {'x': (0, 1), 'y': (2, 1), 'z': (1, 1)},
}
EASE = {'sine': 'SINE', 'quad': 'QUAD', 'cubic': 'CUBIC', 'back': 'BACK', 'bounce': 'BOUNCE',
        'elastic': 'ELASTIC', 'linear': 'LINEAR', 'bezier': 'BEZIER'}


def key(clip, node, channel, axis, keys):
    """keys: list of (t_seconds, three_space_delta[, opts]); opts: i=interpolation, e=easing
    (in/out/inout), h=handle type for bezier (auto|clamped|vector)."""
    clip.setdefault(node, []).append((channel, axis, keys))


class Clip:
    def __init__(self, name, duration, loop):
        self.name, self.duration, self.loop, self.tracks = name, duration, loop, {}

    def k(self, node, channel, axis, keys):
        key(self.tracks, node, channel, axis, keys)


def sine_wave(t0, t1, amp, cycles, phase=0.0, bias=0.0):
    """Quarter-period keys on a sine with SINE easing (starts at rest for phase 0): breathing / sway."""
    import math
    steps = int(cycles * 4)
    keys = []
    for i in range(steps + 1):
        t = t0 + (t1 - t0) * i / steps
        v = bias + amp * math.sin(2 * math.pi * i / steps + phase)
        keys.append((round(t, 4), round(v, 5), {'i': 'sine', 'e': 'inout'}))
    return keys


# ---------------------------------------------------------------- clips
clips = []

idle = Clip('idle', 2.0, True)          # pilot breathing, faint body heave, steering micro-jitter
idle.k('torso', 'pos', 'y', sine_wave(0, 2.0, .006, 1))           # ribcage rise
idle.k('torso', 'rot', 'x', sine_wave(0, 2.0, -.012, 1))           # gentle lean back on the inhale
idle.k('torso', 'scale', 'y', sine_wave(0, 2.0, .011, 1))          # chest expansion
idle.k('head', 'rot', 'x', sine_wave(0, 2.0, -.018, 1, phase=-.5))  # head follows the breath, lagging
idle.k('head', 'rot', 'y', [(0, 0), (.7, .05, {'i': 'sine', 'e': 'inout'}), (1.5, -.03, {'i': 'sine', 'e': 'inout'}), (2.0, 0)])
idle.k('pilot', 'rot', 'z', sine_wave(0, 2.0, .006, 1, phase=-.9))
idle.k('body', 'pos', 'y', sine_wave(0, 2.0, -.003, 1, phase=-.3))  # faint chassis heave on the springs
idle.k('steering-wheel', 'rot', 'z', [(0, 0), (.35, .02), (.55, -.015), (.9, .01), (1.3, -.025), (1.6, .012), (2.0, 0)])
clips.append(idle)

drive = Clip('drive', 1.0, True)        # high-frequency chassis vibration + head bob
vib = [(i / 30, v, {'i': 'linear'}) for i, v in enumerate([0, .004, -.003, .005, -.004, .002, -.005, .004, -.002, .005, -.004, .003, -.005, .002, -.003, .005, -.004, .003, -.002, .004, -.005, .003, -.004, .002, -.003, .005, -.002, .004, -.004, .003])] + [(1.0, 0, {'i': 'linear'})]
drive.k('body', 'pos', 'y', vib)
drive.k('body', 'rot', 'x', [(t, v * .6, o) for t, v, o in vib])
drive.k('body', 'rot', 'z', [(t, -v * .5, o) for t, v, o in vib[::2]] + [(1.0, 0, {'i': 'linear'})])
drive.k('head', 'pos', 'y', [(0, 0), (.25, -.012, {'i': 'sine', 'e': 'inout'}), (.5, 0, {'i': 'sine', 'e': 'inout'}), (.75, -.01, {'i': 'sine', 'e': 'inout'}), (1.0, 0)])
drive.k('head', 'rot', 'x', [(0, 0), (.3, -.03, {'i': 'sine', 'e': 'inout'}), (.55, .01, {'i': 'sine', 'e': 'inout'}), (.8, -.025, {'i': 'sine', 'e': 'inout'}), (1.0, 0)])
drive.k('pilot', 'pos', 'y', [(0, 0), (.2, -.004, {'i': 'sine', 'e': 'inout'}), (.45, .003, {'i': 'sine', 'e': 'inout'}), (.7, -.004, {'i': 'sine', 'e': 'inout'}), (1.0, 0)])
drive.k('steering-wheel', 'rot', 'z', [(0, 0), (.15, .03), (.4, -.035), (.65, .025), (.85, -.02), (1.0, 0)])
clips.append(drive)

drift = Clip('drift', 1.2, True)        # body roll bias, pilot lean/look into the corner, steering saw
drift.k('body', 'rot', 'z', [(0, -.055), (.3, -.075, {'i': 'sine', 'e': 'inout'}), (.6, -.05, {'i': 'sine', 'e': 'inout'}), (.9, -.08, {'i': 'sine', 'e': 'inout'}), (1.2, -.055)])
drift.k('body', 'rot', 'y', [(0, .01), (.3, -.02, {'i': 'sine', 'e': 'inout'}), (.6, .015, {'i': 'sine', 'e': 'inout'}), (.9, -.015, {'i': 'sine', 'e': 'inout'}), (1.2, .01)])
drift.k('body', 'pos', 'y', [(0, -.012), (.3, -.02, {'i': 'sine', 'e': 'inout'}), (.75, -.008, {'i': 'sine', 'e': 'inout'}), (1.2, -.012)])
drift.k('pilot', 'rot', 'z', [(0, .16), (.35, .21, {'i': 'sine', 'e': 'inout'}), (.7, .14, {'i': 'sine', 'e': 'inout'}), (1.2, .16)])
drift.k('pilot', 'pos', 'x', [(0, -.02), (.4, -.035, {'i': 'sine', 'e': 'inout'}), (.85, -.015, {'i': 'sine', 'e': 'inout'}), (1.2, -.02)])
drift.k('head', 'rot', 'y', [(0, .32), (.4, .42, {'i': 'sine', 'e': 'inout'}), (.8, .28, {'i': 'sine', 'e': 'inout'}), (1.2, .32)])
drift.k('head', 'rot', 'z', [(0, -.08), (.5, -.12, {'i': 'sine', 'e': 'inout'}), (1.2, -.08)])
drift.k('steering-wheel', 'rot', 'z', [(0, -.45, {'i': 'linear'}), (.28, .35, {'i': 'quad', 'e': 'out'}), (.6, -.45, {'i': 'linear'}), (.88, .35, {'i': 'quad', 'e': 'out'}), (1.2, -.45)])
drift.k('arm-l', 'rot', 'x', [(0, .1), (.28, -.08, {'i': 'quad', 'e': 'out'}), (.6, .1, {'i': 'linear'}), (.88, -.08, {'i': 'quad', 'e': 'out'}), (1.2, .1)])
drift.k('arm-r', 'rot', 'x', [(0, -.08), (.28, .1, {'i': 'quad', 'e': 'out'}), (.6, -.08, {'i': 'linear'}), (.88, .1, {'i': 'quad', 'e': 'out'}), (1.2, -.08)])
drift.k('underbody-flow-ring', 'scale', 'x', [(0, .04), (.6, .09, {'i': 'sine', 'e': 'inout'}), (1.2, .04)])
clips.append(drift)

boost = Clip('boost', 0.8, False)       # anticipation squat, then stretch; head back; exhaust pulse
boost.k('body', 'pos', 'y', [(0, 0), (.14, -.05, {'i': 'quad', 'e': 'out'}), (.32, .035, {'i': 'back', 'e': 'out'}), (.55, -.008, {'i': 'sine', 'e': 'inout'}), (.8, 0)])
boost.k('body', 'rot', 'x', [(0, 0), (.14, -.03, {'i': 'quad', 'e': 'out'}), (.32, .085, {'i': 'back', 'e': 'out'}), (.6, .015, {'i': 'sine', 'e': 'inout'}), (.8, 0)])
boost.k('body', 'scale', 'z', [(0, 0), (.14, -.04, {'i': 'quad', 'e': 'out'}), (.3, .07, {'i': 'back', 'e': 'out'}), (.8, 0, {'i': 'sine', 'e': 'inout'})])
boost.k('body', 'scale', 'y', [(0, 0), (.14, .03, {'i': 'quad', 'e': 'out'}), (.3, -.035, {'i': 'back', 'e': 'out'}), (.8, 0, {'i': 'sine', 'e': 'inout'})])
boost.k('body', 'scale', 'x', [(0, 0), (.14, .015, {'i': 'quad', 'e': 'out'}), (.3, -.03, {'i': 'back', 'e': 'out'}), (.8, 0, {'i': 'sine', 'e': 'inout'})])
for w, amt in (('wheel-fl', .03), ('wheel-fr', .03), ('wheel-rl', .045), ('wheel-rr', .045)):
    boost.k(w, 'pos', 'y', [(0, 0), (.14, amt, {'i': 'quad', 'e': 'out'}), (.32, -.02, {'i': 'back', 'e': 'out'}), (.8, 0, {'i': 'sine', 'e': 'inout'})])
boost.k('pilot', 'pos', 'z', [(0, 0), (.12, -.015, {'i': 'quad', 'e': 'out'}), (.34, .05, {'i': 'back', 'e': 'out'}), (.8, 0, {'i': 'sine', 'e': 'inout'})])
boost.k('pilot', 'rot', 'x', [(0, 0), (.12, -.04, {'i': 'quad', 'e': 'out'}), (.34, .12, {'i': 'back', 'e': 'out'}), (.8, 0, {'i': 'sine', 'e': 'inout'})])
boost.k('head', 'rot', 'x', [(0, 0), (.12, -.06, {'i': 'quad', 'e': 'out'}), (.36, .3, {'i': 'back', 'e': 'out'}), (.62, .12, {'i': 'sine', 'e': 'inout'}), (.8, 0)])
boost.k('arm-l', 'rot', 'x', [(0, 0), (.14, -.06), (.34, .18, {'i': 'back', 'e': 'out'}), (.8, 0, {'i': 'sine', 'e': 'inout'})])
boost.k('arm-r', 'rot', 'x', [(0, 0), (.14, -.06), (.34, .18, {'i': 'back', 'e': 'out'}), (.8, 0, {'i': 'sine', 'e': 'inout'})])
for e in ('exhaust-l', 'exhaust-r'):
    for ax in ('x', 'y', 'z'):
        boost.k(e, 'scale', ax, [(0, 0), (.12, -.15, {'i': 'quad', 'e': 'out'}), (.26, .7, {'i': 'back', 'e': 'out'}), (.42, .35, {'i': 'sine', 'e': 'inout'}), (.56, .55, {'i': 'sine', 'e': 'inout'}), (.8, 0, {'i': 'quad', 'e': 'inout'})])
boost.k('underbody-flow-ring', 'scale', 'y', [(0, 0), (.3, .12, {'i': 'back', 'e': 'out'}), (.8, 0, {'i': 'sine', 'e': 'inout'})])
clips.append(boost)

spinout = Clip('spinout', 1.1, False)   # tumble roll / yaw wobble, flailing arms, head shake
spinout.k('body', 'rot', 'z', [(0, 0), (.18, .15, {'i': 'quad', 'e': 'out'}), (.48, -.17, {'i': 'sine', 'e': 'inout'}), (.78, .1, {'i': 'sine', 'e': 'inout'}), (.98, -.03, {'i': 'sine', 'e': 'inout'}), (1.1, 0)])
spinout.k('body', 'rot', 'y', [(0, 0), (.28, .13, {'i': 'sine', 'e': 'inout'}), (.66, -.11, {'i': 'sine', 'e': 'inout'}), (1.1, 0, {'i': 'sine', 'e': 'inout'})])
spinout.k('body', 'rot', 'x', [(0, 0), (.22, -.06, {'i': 'sine', 'e': 'inout'}), (.55, .05, {'i': 'sine', 'e': 'inout'}), (1.1, 0, {'i': 'sine', 'e': 'inout'})])
spinout.k('body', 'pos', 'y', [(0, 0), (.14, .055, {'i': 'quad', 'e': 'out'}), (.38, -.01, {'i': 'bounce', 'e': 'out'}), (.7, .025, {'i': 'sine', 'e': 'inout'}), (1.1, 0, {'i': 'bounce', 'e': 'out'})])
spinout.k('pilot', 'rot', 'z', [(0, 0), (.22, -.26, {'i': 'quad', 'e': 'out'}), (.56, .22, {'i': 'sine', 'e': 'inout'}), (.86, -.1, {'i': 'sine', 'e': 'inout'}), (1.1, 0)])
spinout.k('pilot', 'rot', 'x', [(0, 0), (.3, -.1, {'i': 'sine', 'e': 'inout'}), (.7, .06, {'i': 'sine', 'e': 'inout'}), (1.1, 0)])
spinout.k('arm-l', 'rot', 'x', [(0, 0), (.16, 1.15, {'i': 'back', 'e': 'out'}), (.42, .35, {'i': 'sine', 'e': 'inout'}), (.68, 1.25, {'i': 'back', 'e': 'out'}), (.9, .4, {'i': 'sine', 'e': 'inout'}), (1.1, 0)])
spinout.k('arm-l', 'rot', 'z', [(0, 0), (.2, .55, {'i': 'quad', 'e': 'out'}), (.7, .35, {'i': 'sine', 'e': 'inout'}), (1.1, 0)])
spinout.k('arm-r', 'rot', 'x', [(0, 0), (.1, .3, {'i': 'sine', 'e': 'inout'}), (.3, 1.2, {'i': 'back', 'e': 'out'}), (.55, .45, {'i': 'sine', 'e': 'inout'}), (.8, 1.05, {'i': 'back', 'e': 'out'}), (1.1, 0)])
spinout.k('arm-r', 'rot', 'z', [(0, 0), (.25, -.55, {'i': 'quad', 'e': 'out'}), (.75, -.3, {'i': 'sine', 'e': 'inout'}), (1.1, 0)])
spinout.k('head', 'rot', 'y', [(0, 0), (.14, .38, {'i': 'quad', 'e': 'out'}), (.34, -.4, {'i': 'sine', 'e': 'inout'}), (.54, .34, {'i': 'sine', 'e': 'inout'}), (.74, -.28, {'i': 'sine', 'e': 'inout'}), (.92, .12, {'i': 'sine', 'e': 'inout'}), (1.1, 0)])
spinout.k('head', 'rot', 'x', [(0, 0), (.2, -.14, {'i': 'sine', 'e': 'inout'}), (.6, .1, {'i': 'sine', 'e': 'inout'}), (1.1, 0)])
spinout.k('steering-wheel', 'rot', 'z', [(0, 0), (.36, 1.25, {'i': 'quad', 'e': 'out'}), (.78, -.85, {'i': 'sine', 'e': 'inout'}), (1.1, 0, {'i': 'back', 'e': 'out'})])
for w in ('wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr'):
    spinout.k(w, 'pos', 'y', [(0, 0), (.16, .03 if w.endswith('l') else -.02, {'i': 'sine', 'e': 'inout'}), (.5, -.03 if w.endswith('l') else .03, {'i': 'sine', 'e': 'inout'}), (.8, .015, {'i': 'sine', 'e': 'inout'}), (1.1, 0)])
clips.append(spinout)

hit = Clip('hit', 0.6, False)           # recoil pitch, suspension bottoming (wheel y), pilot whiplash
hit.k('body', 'rot', 'x', [(0, 0), (.07, .17, {'i': 'quad', 'e': 'out'}), (.26, -.07, {'i': 'sine', 'e': 'inout'}), (.42, .025, {'i': 'sine', 'e': 'inout'}), (.6, 0)])
hit.k('body', 'pos', 'y', [(0, 0), (.11, -.065, {'i': 'quad', 'e': 'out'}), (.3, .02, {'i': 'bounce', 'e': 'out'}), (.6, 0, {'i': 'sine', 'e': 'inout'})])
hit.k('body', 'pos', 'z', [(0, 0), (.09, .08, {'i': 'quad', 'e': 'out'}), (.6, 0, {'i': 'sine', 'e': 'inout'})])
for w, amt in (('wheel-fl', .045), ('wheel-fr', .045), ('wheel-rl', .025), ('wheel-rr', .025)):
    hit.k(w, 'pos', 'y', [(0, 0), (.1, amt, {'i': 'quad', 'e': 'out'}), (.3, -.012, {'i': 'bounce', 'e': 'out'}), (.6, 0, {'i': 'sine', 'e': 'inout'})])
hit.k('head', 'rot', 'x', [(0, 0), (.06, -.36, {'i': 'quad', 'e': 'out'}), (.24, .22, {'i': 'sine', 'e': 'inout'}), (.4, -.06, {'i': 'sine', 'e': 'inout'}), (.6, 0)])
hit.k('pilot', 'rot', 'x', [(0, 0), (.08, -.13, {'i': 'quad', 'e': 'out'}), (.28, .06, {'i': 'sine', 'e': 'inout'}), (.6, 0, {'i': 'sine', 'e': 'inout'})])
hit.k('pilot', 'pos', 'z', [(0, 0), (.08, -.03, {'i': 'quad', 'e': 'out'}), (.3, .02, {'i': 'sine', 'e': 'inout'}), (.6, 0)])
hit.k('arm-l', 'rot', 'x', [(0, 0), (.09, .42, {'i': 'quad', 'e': 'out'}), (.3, -.1, {'i': 'sine', 'e': 'inout'}), (.6, 0)])
hit.k('arm-r', 'rot', 'x', [(0, 0), (.1, .38, {'i': 'quad', 'e': 'out'}), (.32, -.08, {'i': 'sine', 'e': 'inout'}), (.6, 0)])
hit.k('steering-wheel', 'rot', 'z', [(0, 0), (.09, .28, {'i': 'quad', 'e': 'out'}), (.3, -.12, {'i': 'sine', 'e': 'inout'}), (.6, 0)])
clips.append(hit)

victory = Clip('victory', 2.4, True)    # fist pump (arm-r), head up, body bounce with lagging pilot
victory.k('arm-r', 'rot', 'x', [(0, 0), (.32, 2.45, {'i': 'back', 'e': 'out'}), (.6, 2.05, {'i': 'sine', 'e': 'inout'}), (.85, 2.65, {'i': 'back', 'e': 'out'}), (1.1, 2.05, {'i': 'sine', 'e': 'inout'}), (1.35, 2.65, {'i': 'back', 'e': 'out'}), (1.7, 2.3, {'i': 'sine', 'e': 'inout'}), (2.4, 0, {'i': 'quad', 'e': 'inout'})])
victory.k('arm-r', 'rot', 'z', [(0, 0), (.32, -.35, {'i': 'back', 'e': 'out'}), (1.7, -.3, {'i': 'sine', 'e': 'inout'}), (2.4, 0, {'i': 'quad', 'e': 'inout'})])
victory.k('arm-l', 'rot', 'x', [(0, 0), (.4, .45, {'i': 'sine', 'e': 'inout'}), (.95, .25, {'i': 'sine', 'e': 'inout'}), (1.45, .5, {'i': 'sine', 'e': 'inout'}), (2.4, 0, {'i': 'quad', 'e': 'inout'})])
victory.k('head', 'rot', 'x', [(0, 0), (.36, .28, {'i': 'back', 'e': 'out'}), (.85, .2, {'i': 'sine', 'e': 'inout'}), (1.35, .32, {'i': 'sine', 'e': 'inout'}), (1.8, .22, {'i': 'sine', 'e': 'inout'}), (2.4, 0, {'i': 'quad', 'e': 'inout'})])
victory.k('head', 'rot', 'z', [(0, 0), (.6, .1, {'i': 'sine', 'e': 'inout'}), (1.2, -.08, {'i': 'sine', 'e': 'inout'}), (1.8, .06, {'i': 'sine', 'e': 'inout'}), (2.4, 0)])
victory.k('body', 'pos', 'y', [(0, 0), (.3, .04, {'i': 'sine', 'e': 'inout'}), (.6, 0, {'i': 'bounce', 'e': 'out'}), (.9, .04, {'i': 'sine', 'e': 'inout'}), (1.2, 0, {'i': 'bounce', 'e': 'out'}), (1.5, .035, {'i': 'sine', 'e': 'inout'}), (1.8, 0, {'i': 'bounce', 'e': 'out'}), (2.1, .02, {'i': 'sine', 'e': 'inout'}), (2.4, 0)])
victory.k('body', 'rot', 'x', [(0, 0), (.3, .02, {'i': 'sine', 'e': 'inout'}), (.6, -.01, {'i': 'sine', 'e': 'inout'}), (.9, .02, {'i': 'sine', 'e': 'inout'}), (1.2, -.01, {'i': 'sine', 'e': 'inout'}), (1.5, .015, {'i': 'sine', 'e': 'inout'}), (2.4, 0, {'i': 'sine', 'e': 'inout'})])
victory.k('pilot', 'pos', 'y', [(0, 0), (.38, .03, {'i': 'sine', 'e': 'inout'}), (.68, -.005, {'i': 'sine', 'e': 'inout'}), (.98, .03, {'i': 'sine', 'e': 'inout'}), (1.28, -.005, {'i': 'sine', 'e': 'inout'}), (1.58, .025, {'i': 'sine', 'e': 'inout'}), (1.88, 0, {'i': 'sine', 'e': 'inout'}), (2.4, 0)])
victory.k('torso', 'scale', 'y', [(0, 0), (.34, .025, {'i': 'sine', 'e': 'inout'}), (.64, -.01, {'i': 'sine', 'e': 'inout'}), (.94, .025, {'i': 'sine', 'e': 'inout'}), (1.24, -.01, {'i': 'sine', 'e': 'inout'}), (1.54, .02, {'i': 'sine', 'e': 'inout'}), (2.4, 0, {'i': 'sine', 'e': 'inout'})])
for e in ('exhaust-l', 'exhaust-r'):
    victory.k(e, 'scale', 'x', [(0, 0), (.3, .25, {'i': 'back', 'e': 'out'}), (.6, 0, {'i': 'sine', 'e': 'inout'}), (.9, .25, {'i': 'back', 'e': 'out'}), (1.2, 0, {'i': 'sine', 'e': 'inout'}), (1.5, .2, {'i': 'back', 'e': 'out'}), (1.8, 0, {'i': 'sine', 'e': 'inout'}), (2.4, 0)])
    victory.k(e, 'scale', 'y', [(0, 0), (.3, .25, {'i': 'back', 'e': 'out'}), (.6, 0, {'i': 'sine', 'e': 'inout'}), (.9, .25, {'i': 'back', 'e': 'out'}), (1.2, 0, {'i': 'sine', 'e': 'inout'}), (1.5, .2, {'i': 'back', 'e': 'out'}), (1.8, 0, {'i': 'sine', 'e': 'inout'}), (2.4, 0)])
clips.append(victory)

defeat = Clip('defeat', 2.4, True)      # slumped torso/head with a slow sway; seamless loop
defeat.k('pilot', 'rot', 'x', [(0, -.2), (1.2, -.16, {'i': 'sine', 'e': 'inout'}), (2.4, -.2, {'i': 'sine', 'e': 'inout'})])
defeat.k('pilot', 'pos', 'y', [(0, -.03), (1.2, -.024, {'i': 'sine', 'e': 'inout'}), (2.4, -.03, {'i': 'sine', 'e': 'inout'})])
defeat.k('head', 'rot', 'x', [(0, -.46), (1.3, -.38, {'i': 'sine', 'e': 'inout'}), (2.4, -.46, {'i': 'sine', 'e': 'inout'})])
defeat.k('head', 'rot', 'z', [(0, .12), (.8, -.02, {'i': 'sine', 'e': 'inout'}), (1.6, -.1, {'i': 'sine', 'e': 'inout'}), (2.4, .12, {'i': 'sine', 'e': 'inout'})])
defeat.k('torso', 'scale', 'y', [(0, -.03), (1.1, -.02, {'i': 'sine', 'e': 'inout'}), (2.4, -.03, {'i': 'sine', 'e': 'inout'})])
defeat.k('body', 'rot', 'z', sine_wave(0, 2.4, .014, 1))
defeat.k('body', 'pos', 'y', [(0, -.02), (1.2, -.014, {'i': 'sine', 'e': 'inout'}), (2.4, -.02, {'i': 'sine', 'e': 'inout'})])
defeat.k('arm-l', 'rot', 'x', [(0, -.28), (1.0, -.34, {'i': 'sine', 'e': 'inout'}), (2.4, -.28, {'i': 'sine', 'e': 'inout'})])
defeat.k('arm-r', 'rot', 'x', [(0, -.3), (1.4, -.36, {'i': 'sine', 'e': 'inout'}), (2.4, -.3, {'i': 'sine', 'e': 'inout'})])
defeat.k('steering-wheel', 'rot', 'z', [(0, -.15), (1.2, .1, {'i': 'sine', 'e': 'inout'}), (2.4, -.15, {'i': 'sine', 'e': 'inout'})])
clips.append(defeat)

assert [c.name for c in clips] == CLIP_NAMES

# ---------------------------------------------------------------- keying
for act in list(bpy.data.actions):
    if act.get('zf_clip'):
        bpy.data.actions.remove(act)

kart_ids = sorted({o['zf_kart'] for o in bpy.data.objects if o.get('zf_kart')})
actions = {}
for clip in clips:
    act = bpy.data.actions.new(clip.name)
    act['zf_clip'] = clip.name
    act.use_fake_user = True  # keep unassigned clips alive across saves
    act['zf_duration'] = clip.duration
    act['zf_loop'] = clip.loop
    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, round(clip.duration * FPS)
    act.use_cyclic = clip.loop
    strip = act.layers.new('Layer').strips.new(type='KEYFRAME')
    actions[clip.name] = act
    for node, tracks in clip.tracks.items():
        assert node in ANIMATABLE_NODES, node
        ref = find_node(bpy, REFERENCE, node)
        assert ref is not None, f"reference rig has no node {node}"
        slot = act.slots.new(id_type='OBJECT', name=node)
        ref.animation_data_create()
        ref.animation_data.action = act
        ref.animation_data.action_slot = slot
        bag = strip.channelbag(slot, ensure=True)
        rest = {'pos': ref['zf_rest_loc'], 'rot': ref['zf_rest_rot'], 'scale': ref['zf_rest_scale']}
        for channel, axis, keys in tracks:
            index, sign = AXIS[channel][axis]
            fc = bag.fcurves.find(CHANNEL[channel], index=index) or bag.fcurves.new(CHANNEL[channel], index=index)
            for k in keys:
                t, v, opts = (k + ({},))[:3]
                base = 1.0 if channel == 'scale' else 0.0
                kp = fc.keyframe_points.insert(t * FPS, rest[channel][index] + sign * v)
                interp = EASE[opts.get('i', 'bezier')]
                kp.interpolation = interp
                kp.easing = {'in': 'EASE_IN', 'out': 'EASE_OUT', 'inout': 'EASE_IN_OUT'}.get(opts.get('e'), 'AUTO')
                h = {'auto': 'AUTO', 'clamped': 'AUTO_CLAMPED', 'vector': 'VECTOR'}[opts.get('h', 'clamped')]
                kp.handle_left_type = kp.handle_right_type = h
            if clip.loop:
                fc.modifiers.new('CYCLES')
            fc.update()

# Assign the clips to every kart so the review renders show all twelve animated (node names are
# shared); the .blend is saved with 'idle' playing. See kartrig_common.assign_clip.
scene['zf_clips'] = json.dumps({c.name: {'duration': c.duration, 'loop': c.loop, 'frames': round(c.duration * FPS)} for c in clips})
assign_clip(bpy, 'idle')
scene.frame_end = round(idle.duration * FPS)
bpy.ops.wm.save_as_mainfile(filepath=target, compress=True)
total = sum(len(fc.keyframe_points) for a in actions.values() for s in a.slots for fc in a.layers[0].strips[0].channelbag(s).fcurves)
print(f"authored {len(actions)} clips, {sum(len(a.slots) for a in actions.values())} slots, {total} keyframes -> {target}")
