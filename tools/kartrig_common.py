"""Shared helpers for the ZenFlow Racer kart Blender pipeline (imported by the tools/*.py
Blender scripts via sys.path; never shipped to browsers).

Coordinate convention between the Three.js runtime and Blender:
    Three (x, y, z)  ->  Blender (x, -z, y)        (Three +y up -> Blender +z up)
    Blender (x, y, z) ->  Three (x, z, -y)
A rotation about Blender +Y is a rotation about Three -Z, so Euler deltas map as
    Three (rx, ry, rz) = (bx, bz, -by)
Scale deltas are magnitudes: Three (sx, sy, sz) = (bx, bz, by).
"""
import math

# Node names the runtime clip sampler (vehicles.js sampleKartClip) knows how to drive.
CONTRACT_NODES = [
    'body', 'pilot', 'torso', 'head', 'hair', 'arm-l', 'arm-r', 'steering-wheel',
    'exhaust-l', 'exhaust-r', 'wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr', 'spin',
    'wheel-light-ring', 'underbody-flow-ring', 'aegis-shield', 'coachwork-batch',
]
# Nodes that an animator may key (unique per kart; 'spin', rings and batches are runtime driven).
ANIMATABLE_NODES = [
    'body', 'pilot', 'torso', 'head', 'arm-l', 'arm-r', 'steering-wheel', 'exhaust-l', 'exhaust-r',
    'wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr', 'underbody-flow-ring', 'aegis-shield',
]
CLIP_NAMES = ['idle', 'drive', 'drift', 'boost', 'spinout', 'hit', 'victory', 'defeat']
FPS = 30

# Rest placement (Three space) for placeholder Empties when the current runtime rig does not
# define a contract node yet: name -> (parent contract node or None for the kart root, position).
PLACEHOLDERS = {
    'body': (None, (0, 0, 0)),
    'pilot': ('body', (0, 1, .37)),
    'torso': ('pilot', (0, 0, 0)),
    'head': ('pilot', (0, .62, -.02)),
    'arm-l': ('pilot', (-.22, .42, -.04)),
    'arm-r': ('pilot', (.22, .42, -.04)),
    'steering-wheel': ('body', (0, 1.45, -.34)),
    'exhaust-l': ('body', (-.48, .37, 1.89)),
    'exhaust-r': ('body', (.48, .37, 1.89)),
    'wheel-fl': (None, (-1.23, .6, -1.25)),
    'wheel-fr': (None, (1.23, .6, -1.25)),
    'wheel-rl': (None, (-1.23, .6, 1.28)),
    'wheel-rr': (None, (1.23, .6, 1.28)),
    'underbody-flow-ring': (None, (0, .19, 0)),
    'aegis-shield': (None, (0, .9, 0)),
}


def three_to_blender(v):
    x, y, z = v
    return (x, -z, y)


def blender_to_three(v):
    x, y, z = v
    return (x, z, -y)


def blender_rot_delta_to_three(r):
    bx, by, bz = r
    return (bx, bz, -by)


def blender_scale_delta_to_three(s):
    bx, by, bz = s
    return (bx, bz, by)


def three_euler_xyz_from_matrix(m):
    """Replicates THREE.Euler.setFromRotationMatrix(order='XYZ') for a 3x3 row-major matrix."""
    m11, m12, m13 = m[0]
    m21, m22, m23 = m[1]
    m31, m32, m33 = m[2]
    y = math.asin(max(-1.0, min(1.0, m13)))
    if abs(m13) < 0.9999999:
        x = math.atan2(-m23, m33)
        z = math.atan2(-m12, m11)
    else:
        x = math.atan2(m32, m22)
        z = 0.0
    return (x, y, z)


def blender_matrix_to_three(mb):
    """Conjugate a Blender-space 3x3 rotation into Three space: M_t = C * M_b * C^T with
    C = [[1,0,0],[0,0,1],[0,-1,0]] (blender -> three)."""
    C = ((1, 0, 0), (0, 0, 1), (0, -1, 0))

    def mul(a, b):
        return tuple(tuple(sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)) for i in range(3))

    Ct = tuple(tuple(C[j][i] for j in range(3)) for i in range(3))
    return mul(mul(C, mb), Ct)


def find_kart_root(bpy, kart_id):
    for obj in bpy.data.objects:
        if obj.get('zf_kart') == kart_id and obj.get('zf_root'):
            return obj
    return None


def find_node(bpy, kart_id, node, kind=None):
    """Return the Blender object for runtime node `node` of kart `kart_id`. Groups win over
    same-named meshes (the contract's 'head' Group is the neck pivot, its child mesh is skin)."""
    best = None
    for obj in bpy.data.objects:
        if obj.get('zf_kart') != kart_id or obj.get('zf_node') != node:
            continue
        if kind and obj.get('zf_kind') != kind:
            continue
        if best is None or (obj.get('zf_kind') == 'group' and best.get('zf_kind') != 'group'):
            best = obj
    return best


def clip_action(bpy, name):
    return next((a for a in bpy.data.actions if a.get('zf_clip') == name), None)


def assign_clip(bpy, name, kart_ids=None):
    """Play clip `name` on every kart (or only `kart_ids`): each rig node whose runtime name has a
    slot in the clip's Action gets that Action+slot; other animated nodes fall back to rest."""
    act = clip_action(bpy, name)
    assert act is not None, f"no authored clip named {name}"
    slots = {s.name_display: s for s in act.slots}
    for obj in bpy.data.objects:
        node, kart = obj.get('zf_node'), obj.get('zf_kart')
        if not node or not kart or (kart_ids and kart not in kart_ids):
            continue
        if node in slots and find_node(bpy, kart, node) is obj:
            obj.animation_data_create()
            obj.animation_data.action = act
            obj.animation_data.action_slot = slots[node]
        elif obj.animation_data:
            obj.animation_data.action = None
    return act
