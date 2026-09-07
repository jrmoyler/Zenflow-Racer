# WebGL lighting follow-up

Base: merged PR #10, main `a431843b8b013ea8965ed0e889d152b938ebe726`.

## Findings and changes

The previous pass changed fonts, menu composition, transitions, lighting strengths and
material properties. It did not replace the twelve authored GLBs. The supplied original
JPEGs are readable and show glossy cyan/pearl surfaces against lavender skies and luminous
road edges. They are inspection references only; no image enters the runtime.

The existing r128 composer and every bloom mip defaulted to unsigned-byte targets. Scene
materials applied ACES before bloom, limiting highlight range before thresholding and
blurring. Custom sky, water and rail shaders skipped tone mapping and display encoding,
so their output also differed between direct and composer rendering.

This change keeps scene and bloom targets linear half-float, applies ACES and sRGB once
in the final grade, and restores the renderer's normal display transform before direct
showroom/portrait draws, including on errors. Unsupported half-float devices use direct
rendering. Custom scene shaders now honor the same transform. Water Fresnel uses the
surface normal and camera direction in view space; the old calculation was a constant.

## Validation and acceptance

`npm run verify` passes, including new tests executing the real vendored postprocessing
classes: HDR target types throughout the mip chain, capability fallback, exposure transfer,
renderer restoration on success/failure, and water view response. Existing tests exercise
all three circuits and twelve GLB rigs/materials. These are CPU contract and runtime tests,
not GPU shader-compilation or image-match evidence.

Exact likeness is **not complete**. The mandatory img2threejs gate still returns exit 3,
`status=stopped`, with the third authored candidate below the .95 target. No supported
resumption operation exists in the installed workflow. The new user request authorizes
continuation, but this patch does not reset review state or assert an unearned pass.
See `3d-reconstruction/followup-blockers.md` for the preserved rejection history and
conflicts between the original four-driver JPEG and later twelve-division sheets.

Required visual acceptance: capture actual WebGL title, selection and chase views on all
three circuits; compare ordinary materials, sky and water between default and `?lowfx`;
check highlights during drift/boost and map changes; verify no shader/FBO errors; measure
mobile frame time on a physical device. The available cloud browser previously selected
Software 3D, which cannot validate these WebGL changes. Keep this PR draft until GPU
captures and the stopped likeness workflow can be addressed.
