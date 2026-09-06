"""Blender-authored continuous playable driver/kart geometry from image2threejs spec.

  blender -b .tools/zenflow-karts.blend --python tools/author-playable-karts.py -- .tools/playable-karts.blend

Imports the existing articulated assembly only as a proportion/pivot scaffold. This pass
welds disconnected triangles, reconstructs the pilot as voxel-unioned anatomical surfaces,
resolves body surface normals, authors real enamel bonnet panels, and refines wheel rims.
No reference screenshots, billboards or image-projected surfaces are embedded.
"""
import bpy,bmesh,sys,os,math,json
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];target=os.path.abspath(args[0])
PALETTE={'zenflow':'20CFF5','collective':'065F46','hybrid':'0EA5E9','nexus':'FF9E32','kinetic':'16A34A','juris':'C9A84C','signal':'F43F5E','loom':'B869F3','vector':'309DFF','aether':'B5451B','animus':'22D3EE','helix':'14B8A6'}
TRIM={'zenflow':'00B4FF','collective':'B87333','hybrid':'FF8A00','nexus':'FF7800','kinetic':'1F2937','juris':'1E3A8A','signal':'F43F5E','loom':'B869F3','vector':'24354A','aether':'B87333','animus':'00B4FF','helix':'FF7800'}
def lin(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def color(h):return tuple(lin(int(h[i:i+2],16)/255) for i in [0,2,4])+(1,)
def weld(obj):
    if obj.type!='MESH':return
    obj.data=obj.data.copy();bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000025)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free();obj.data.update()
    for p in obj.data.polygons:p.use_smooth=True

def apply(obj,mod):
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def continuous_torso(obj):
    # Replace the overlapping torso/pectoral/abdominal lobes by one anatomical envelope.
    # Retain seated leg vertices below the hip; the capped volumes are joined downstream.
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z>.10],context='VERTS')
    bm.to_mesh(obj.data);bm.free()
    verts=[tuple(v.co) for v in obj.data.vertices];faces=[tuple(p.vertices) for p in obj.data.polygons]
    offset=len(verts);around=48;levels=48
    profile=[(0,.19,.17),(.12,.29,.22),(.33,.27,.19),(.52,.31,.20),(.75,.40,.235),(.9,.41,.22),(1,.33,.17),(1.065,.20,.145),(1.12,.115,.11),(1.27,.12,.11)]
    for j in range(levels+1):
        z=j/levels*1.27
        lo=next((k for k in range(len(profile)-1) if profile[k][0]<=z<=profile[k+1][0]),len(profile)-2)
        a,b=profile[lo],profile[lo+1];t=(z-a[0])/(b[0]-a[0]);t=t*t*(3-2*t)
        rx=a[1]+(b[1]-a[1])*t;ry=a[2]+(b[2]-a[2])*t
        for k in range(around):
            theta=k/around*math.tau;x=rx*math.sin(theta);front=max(0,math.cos(theta))**3
            # Smooth pectoral fan and shallow segmented abdominal relief, no intersecting shells.
            pec=.036*sum(math.exp(-((x-side*.16)/.14)**2-((z-.78)/.14)**2) for side in [-1,1])
            abdomen=.012*sum(math.exp(-((x-side*.10)/.085)**2-((z-height)/.052)**2) for side in [-1,1] for height in [.24,.38,.51])
            sternum=.010*math.exp(-(x/.035)**2)*math.exp(-((z-.60)/.40)**4)
            y=ry*math.cos(theta)+(pec+abdomen-sternum)*front
            verts.append((x,y,z))
    for j in range(levels):
        for k in range(around):
            a=offset+j*around+k;b=offset+j*around+(k+1)%around;faces.append((a,b,b+around,a+around))
    mesh=bpy.data.meshes.new(obj.name+'-continuous-anatomy');mesh.from_pydata(verts,[],faces)
    for mat in obj.data.materials:mesh.materials.append(mat)
    mesh.update();obj.data=mesh

def reconstruct_skin(obj,voxel):
    # Union pectorals, abdominal lobes and limb envelopes into one connected surface.
    source_mesh=obj.data.copy()
    before=[max(v.co[i] for v in obj.data.vertices)-min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    bm=bmesh.new();bm.from_mesh(obj.data)
    boundaries=[e for e in bm.edges if e.is_boundary]
    if boundaries:bmesh.ops.holes_fill(bm,edges=boundaries,sides=0)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free();obj.data.update()
    bpy.context.view_layer.objects.active=obj
    rem=obj.modifiers.new('Anatomical volume union','REMESH');rem.mode='VOXEL';rem.voxel_size=voxel;rem.use_smooth_shade=True;apply(obj,rem)
    smooth=obj.modifiers.new('Controlled skin relaxation','SMOOTH');smooth.factor=.48;smooth.iterations=4;apply(obj,smooth)
    dec=obj.modifiers.new('Mobile anatomical retopology','DECIMATE');dec.ratio=.16;apply(obj,dec)
    after=[max(v.co[i] for v in obj.data.vertices)-min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    if any(a < b*.9 for a,b in zip(after,before)):
        raise RuntimeError('Anatomical reconstruction lost body extent: '+obj.name+' '+str((before,after)))
    bpy.data.meshes.remove(source_mesh)
    for p in obj.data.polygons:p.use_smooth=True

def material(name,h,metal=.55,rough=.19):
    mat=bpy.data.materials.new(name);mat.use_nodes=True;b=mat.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=color(h);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
    b.inputs['Coat Weight'].default_value=.28;b.inputs['Coat Roughness'].default_value=.10
    mat.diffuse_color=color(h);return mat

def mesh_child(root,name,verts,faces,mat):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);mesh.update()
    obj=bpy.data.objects.new(root['zf_kart']+':'+name,mesh);root.users_collection[0].objects.link(obj);obj.parent=root
    obj['zf_kart']=root['zf_kart'];obj['zf_node']=name;obj['zf_runtime_name']=name;obj['zf_kind']='mesh';obj['zf_authored']='Blender continuous surface'
    for p in mesh.polygons:p.use_smooth=True
    return obj

def smooth_rows(rows,steps=4):
    out=[]
    for k in range(len(rows)-1):
        a=rows[max(0,k-1)];b=rows[k];c=rows[k+1];d=rows[min(len(rows)-1,k+2)]
        for j in range(steps):
            t=j/steps;v=[]
            for i in range(len(b)):
                x=.5*((2*b[i])+(-a[i]+c[i])*t+(2*a[i]-5*b[i]+4*c[i]-d[i])*t*t+(-a[i]+3*b[i]-3*c[i]+d[i])*t*t*t)
                v.append(max(min(b[i],c[i]),min(max(b[i],c[i]),x)))
            out.append(v)
    out.append(rows[-1]);return out

def bonnet(body,kart,mat):
    if kart in ('collective','nexus','aether'):return # Their grille / turbine / dish occupies this region.
    sharp=kart in ('signal','vector');length=2.55 if sharp else 1.92 if kart=='animus' else 2.05 if kart in ('loom','helix') else 2.18 if kart=='kinetic' else 2.15
    width=.34 if kart=='kinetic' else .43 if kart=='animus' else .46 if kart in ('loom','helix') else .73 if kart=='juris' else .57
    height=.88 if kart=='kinetic' else .99 if kart=='animus' else .85 if kart in ('loom','helix') else 1.02
    rows=smooth_rows([[-length,.015,.5,.025],[-length+.28,width*.5,.58,.13],[-1.3,width,.73,.23],[-.7,width*.77,height,.22],[-.4,.43,.91,.07]],8)
    verts=[];faces=[];segments=12
    # Narrow curved enamel insert conforms to the broad top skin of the nose.
    for j,(z,w,y,h) in enumerate(rows):
        u=j/(len(rows)-1);span=.76*math.sin(math.pi*u)**.38
        for k in range(segments+1):
            a=(k/segments*2-1)*span
            verts.append((math.sin(a)*w,-z,y+math.cos(a)*h+(.045 if sharp else .009)))
    for j in range(len(rows)-1):
        for k in range(segments):
            a=j*(segments+1)+k;b=a+segments+1;faces.append((a,a+1,b+1,b))
    obj=mesh_child(body,'bonnet-enamel-inlay',verts,faces,mat)
    solid=obj.modifiers.new('Enamel edge thickness','SOLIDIFY');solid.thickness=.005;apply(obj,solid)

def wheel_dish(obj,mat):
    verts=[];faces=[];seg=48
    profile=[(0,.15),(.10,.16),(.27,.19),(.39,.245),(.44,.27)]
    for side in [-1,1]:
        base=len(verts)
        for r,x in profile:
            for i in range(seg):
                a=i/seg*math.tau;verts.append((side*x,r*math.sin(a),r*math.cos(a)))
        for j in range(len(profile)-1):
            for i in range(seg):
                a=base+j*seg+i;b=base+j*seg+(i+1)%seg;faces.append((a,b,b+seg,a+seg))
    mesh=bpy.data.meshes.new(obj.name+'-concave-dish');mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);obj.data=mesh;weld(obj)

def front_fairings(body,kart,white,dark):
    if kart not in ('zenflow','hybrid'):return
    rows=smooth_rows([[-2.04,.25,.025,.40,.025],[-1.72,.62,.21,.53,.12],[-1.24,.85,.24,.72,.21],[-.68,.80,.19,.87,.18],[-.31,.61,.025,.89,.035]],6)
    for side in [-1,1]:
        vertices=[];faces=[];seg=16
        for z,center,width,y,depth in rows:
            for i in range(seg):
                a=i/seg*math.tau;vertices.append((side*(center+math.sin(a)*width),-z,y+math.cos(a)*depth))
        for j in range(len(rows)-1):
            for i in range(seg):
                a=j*seg+i;b=j*seg+(i+1)%seg;faces.append((a,b,b+seg,a+seg))
        obj=mesh_child(body,'sculpted-front-fairing-'+str(side),vertices,faces,white);weld(obj)
    rows=smooth_rows([[-2.15,.01,.32,.015],[-1.91,.63,.30,.045],[-1.50,.78,.32,.08],[-1.1,.55,.34,.04]],5)
    verts=[];faces=[];seg=20
    for z,width,y,depth in rows:
        for i in range(seg):
            a=i/seg*math.tau;verts.append((math.sin(a)*width,-z,y+math.cos(a)*depth))
    for j in range(len(rows)-1):
        for i in range(seg):
            a=j*seg+i;b=j*seg+(i+1)%seg;faces.append((a,b,b+seg,a+seg))
    mesh_child(body,'front-undertray-diffuser',verts,faces,dark)

# Convert source swatches from display sRGB to glTF linear factors, rather than baking light.
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    bs=mat.node_tree.nodes.get('Principled BSDF')
    if not bs:continue
    for key in ['Base Color','Emission Color']:
        c=bs.inputs[key].default_value;bs.inputs[key].default_value=tuple(lin(x) for x in c[:3])+(c[3],)
    bs.inputs['Coat Roughness'].default_value=.1

report=[]
for root in [o for o in bpy.data.objects if o.get('zf_root')]:
    kart=root['zf_kart'];objects=[o for o in bpy.data.objects if o.get('zf_kart')==kart]
    skin=material(kart+'-reference-anatomical-enamel',PALETTE[kart],.92,.19)
    enamel=material(kart+'-reference-bonnet-enamel','008AC2' if kart=='zenflow' else PALETTE[kart] if kart!='juris' else TRIM[kart],.55,.20)
    dish=material(kart+'-recessed-wheel-enamel','083649' if kart=='zenflow' else '132839',.65,.24)
    ring=material(kart+'-reference-luminous-rim',TRIM[kart] if kart in ('collective','hybrid','nexus','aether','helix') else PALETTE[kart],.45,.17)
    rb=ring.node_tree.nodes.get('Principled BSDF');rb.inputs['Emission Color'].default_value=rb.inputs['Base Color'].default_value;rb.inputs['Emission Strength'].default_value=.4
    for obj in objects:
        weld(obj);name=obj.get('zf_runtime_name',obj.get('zf_node',''))
        if obj.type!='MESH':continue
        if name in ('torso','arm-l-mesh','arm-r-mesh','head-mesh'):
            obj.data.materials.clear();obj.data.materials.append(skin)
            if name=='torso':
                continuous_torso(obj);reconstruct_skin(obj,.016)
            elif name in ('arm-l-mesh','arm-r-mesh'):reconstruct_skin(obj,.012)
            elif name=='head-mesh':
                for v in obj.data.vertices:v.co.x*=.94;v.co.y*=.95;v.co.z*=.94
        if name=='coachwork-batch':
            dec=obj.modifiers.new('Mobile static coachwork LOD','DECIMATE');dec.ratio=.68;apply(obj,dec)
        if name=='recessed-colored-hub':wheel_dish(obj,dish)
        if name in ('wheel-light-ring','translucent-tire-band'):
            obj.data.materials.clear();obj.data.materials.append(ring)
        if name=='rounded-wheel-shell':
            bevel=obj.modifiers.new('Machined rim shoulder','BEVEL');bevel.width=.012;bevel.segments=2;bevel.limit_method='ANGLE';bevel.angle_limit=.48;apply(obj,bevel)
        # Machined spokes need stable edge normals and an actual highlight-catching bevel.
        if name=='machined-wheel-spokes':
            for v in obj.data.vertices:v.co.x*=.85;v.co.y*=.65;v.co.z*=.65
            obj.data.materials.clear();obj.data.materials.append(dish)
            bevel=obj.modifiers.new('Machined spoke bevel','BEVEL');bevel.width=.018;bevel.segments=2;bevel.limit_method='ANGLE';apply(obj,bevel)
    body=next(o for o in objects if o.get('zf_node')=='body');bonnet(body,kart,enamel)
    pearl=material(kart+'-fairing-pearl','F8FBFF',.24,.23)
    front_fairings(body,kart,pearl,dish)
    root['zf_blender_authored']=True
    root['zf_author_operations']=json.dumps(['welded coachwork and corrected normals','voxel union anatomical torso and arms','controlled smooth and decimated anatomy','reference sRGB-to-linear enamel palette','conformal curved bonnet insert','machined spoke and rim bevels','concave dark wheel dishes and saturated light rims','variant-specific enclosed front fairings','parametric continuous pectoral and abdominal envelope'])
    report.append({'id':kart,'operations':json.loads(root['zf_author_operations'])})
    print('AUTHORED',kart,flush=True)
os.makedirs(os.path.dirname(target),exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=target,compress=True)
print('Saved authored playable geometry',target)
