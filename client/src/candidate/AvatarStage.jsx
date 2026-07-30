// candidate/AvatarStage.jsx
//
// VRM-based avatar for the voice interview stage. Loads a full-body VRM
// ("Ammy", client/public/models/ammy.vrm) and frames a tight upper-body
// ("bust") shot by aiming a fixed camera at the model's head/chest bones —
// the rest of the body is simply out of frame below, same idea as a webcam
// crop. There is no procedural mesh anymore; the old primitive-built head
// is gone.
//
// SAME PUBLIC CONTRACT as the previous version, so VoiceInterview.jsx does
// not need to change at all:
//   <AvatarStage mode={mode} mouthRef={mouthRef} />
// - `mode`: 'idle' | 'listening' | 'processing' | 'ammy-speaking' — drives
//   the rim-light color, identical MODE_COLOR mapping to before.
// - `mouthRef`: a ref that VoiceInterview.jsx stamps with performance.now()
//   on each TTS word-boundary/start event. Mouth openness is derived from
//   time-since-last-boundary, same approximation as before (there's no real
//   phoneme/audio data server-side) — just applied to the VRM's `aa` mouth
//   expression instead of a jaw-pivot mesh.
//
// SETUP REQUIRED IN YOUR PROJECT:
//   npm install three @pixiv/three-vrm
// and make sure the model is reachable at /models/ammy.vrm — i.e. it lives
// at client/public/models/ammy.vrm (Vite/CRA serve /public at the site
// root, so that file becomes GET /models/ammy.vrm).

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import './AvatarStage.css';

const MODEL_URL = '/models/ammy.vrm';

const MODE_COLOR = {
  idle: 0x3c3c3c,
  listening: 0x44ff88,
  processing: 0xffb432,
  'ammy-speaking': 0xe8ff47,
};

const MOUTH_PULSE_MS = 170; // how long one word's mouth-open pulse lasts

// Rotates a VRM's arms from its default T-pose down into a relaxed
// "at ease" stance. Uses the VRM's NORMALIZED bone nodes — a proxy
// skeleton that the VRM spec guarantees is in the same canonical T-pose
// orientation for every compliant model, regardless of how the underlying
// rig's raw bones are authored. That's what makes a single fixed rotation
// value work across different VRM exports rather than needing per-model
// tuning of axes.
//
// NOTE: if your model's arms move the WRONG way after this (e.g. arms
// swing up/forward instead of down to the sides), your rig may not be a
// fully spec-compliant VRM humanoid — flip the sign on the .rotation.z
// lines below to test the opposite direction first.
function relaxTPose(vrm) {
  const bone = (name) => vrm.humanoid?.getNormalizedBoneNode(name) ?? null;
  const leftUpperArm = bone('leftUpperArm');
  const rightUpperArm = bone('rightUpperArm');
  const leftLowerArm = bone('leftLowerArm');
  const rightLowerArm = bone('rightLowerArm');
  const leftHand = bone('leftHand');
  const rightHand = bone('rightHand');

  const armRad = THREE.MathUtils.degToRad(ARM_DOWN_DEG);
  const elbowRad = THREE.MathUtils.degToRad(ELBOW_BEND_DEG);

  if (leftUpperArm) leftUpperArm.rotation.z = -armRad;
  if (rightUpperArm) rightUpperArm.rotation.z = armRad;

  // A slight elbow bend and wrist-in relaxation, so the arms don't look
  // ramrod-straight once they're down at the sides.
  if (leftLowerArm) leftLowerArm.rotation.z = -elbowRad;
  if (rightLowerArm) rightLowerArm.rotation.z = elbowRad;
  if (leftHand) leftHand.rotation.z = -elbowRad * 0.5;
  if (rightHand) rightHand.rotation.z = elbowRad * 0.5;

  // Push the normalized pose we just set into the model's actual skinned
  // mesh (same mechanism the per-frame tick loop already relies on for
  // head sway/blink/mouth — vrm.update() copies normalized → raw bones).
  vrm.update(0);
}

// ── Framing tuning ──────────────────────────────────────────────────────
// These are fractions of the model's TOTAL height (crown to feet), not
// fixed meters — so they adapt automatically whatever scale your VRM was
// exported at. If the face still sits too high/low in the circle, nudge
// these two numbers first; everything else derives from them.
//
// FACE_CENTER_FRAC: how far down from the crown to aim the camera.
//   ~0.08-0.10 lands around the eyes/nose for average human proportions.
//   Stylized/anime-proportioned VRMs (bigger head relative to body) may
//   want a slightly larger value, e.g. 0.12-0.16.
// VISIBLE_HEIGHT_FRAC: how tall a vertical slice of the model to show.
//   Bigger = more of the chest/shoulders visible, smaller = tighter on
//   the face. ~0.30-0.38 reads as a natural interview "bust" shot.
const FACE_CENTER_FRAC = 0.1;
const VISIBLE_HEIGHT_FRAC = 0.34;

// ── Rest-pose fix ───────────────────────────────────────────────────────
// VRM/VRoid exports default to a T-pose (arms straight out horizontally),
// which is meant for animation retargeting, not for standing display. Left
// as-is, the horizontal arms read as huge shoulders once the camera is
// framed tight on the upper body. These rotate the arms down to a relaxed
// "at ease" stance once, right after load.
//
// Degrees to rotate each upper arm DOWN from horizontal (T-pose) toward
// the sides. ~70-80° is a natural resting arm angle for most rigs.
const ARM_DOWN_DEG = 75;
// A small elbow bend so the arms read as relaxed rather than ramrod-straight.
const ELBOW_BEND_DEG = 12;

export default function AvatarStage({ mode = 'idle', mouthRef }) {
  const wrapRef = useRef(null);
  const modeRef = useRef(mode);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let cancelled = false;
    const disposables = [];
    const track = (obj) => {
      disposables.push(obj);
      return obj;
    };

    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    wrap.appendChild(renderer.domElement);

    // ── Lighting ──────────────────────────────────────────────────────────
    // Warm three-point setup, tuned for three.js's physically-correct light
    // units (default since r155). If the model renders as a near-black
    // silhouette, it IS loading — it's just under-lit; bump these first.
    scene.add(new THREE.HemisphereLight(0xfff2df, 0x2a1e18, 1.2));
    scene.add(track(new THREE.AmbientLight(0xfff1de, 1.4)));
    const key = new THREE.DirectionalLight(0xffdcae, 3.2);
    key.position.set(1.2, 2, 2.6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdce8ff, 1.1);
    fill.position.set(-2, 0.6, 1.6);
    scene.add(fill);
    const rim = new THREE.PointLight(0xe8ff47, 6, 6, 1.8);
    rim.position.set(-1, 1.2, 1.2);
    scene.add(rim);

    const clock = new THREE.Clock();
    let vrm = null;
    let raf = null;
    let blinkAt = performance.now() + 2000 + Math.random() * 2000;
    let blinkPhase = 0;

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (cancelled) return;
        vrm = gltf.userData.vrm;

        // VRM 0.x exports (e.g. straight out of VRoid Studio) face +Z;
        // the VRM 1.0 / three.js convention faces -Z. Rotate 0.x models so
        // they face the camera instead of showing their back.
        if (vrm.meta?.metaVersion === '0' || vrm.meta?.specVersion === '0.0') {
          VRMUtils.rotateVRM0(vrm);
        }

        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.removeUnnecessaryJoints(gltf.scene);
        vrm.scene.traverse((obj) => {
          obj.frustumCulled = false; // skinned mesh + tight camera crop can
        }); // otherwise get incorrectly culled near frame edges

        scene.add(vrm.scene);

        // Fix the default T-pose BEFORE measuring the bounding box below —
        // relaxed arms take up less horizontal space than a T-pose, and we
        // want the framing math to see the pose it'll actually be displayed
        // in, not the rest pose.
        relaxTPose(vrm);
        vrm.scene.updateMatrixWorld(true); // bone rotations don't propagate
        // to world-space transforms until the next matrix update — force it
        // now so Box3 below reflects the new arm position, not the old one.

        // ── Frame a tight bust/upper-body shot ───────────────────────────
        // Bounding-box based, NOT bone-name based. Looking up 'head'/'chest'
        // bones and framing off their world position seems reasonable, but
        // if either lookup returns null (bone-naming mismatches are common
        // across different VRM exporters/rigs), the position silently stays
        // at (0,0,0) — hip height on a standing rig — and the camera ends up
        // centered on the waist instead of the face. Using the model's
        // actual rendered bounding box sidesteps that failure mode entirely.
        const box = new THREE.Box3().setFromObject(vrm.scene);
        const crownY = box.max.y;
        const feetY = box.min.y;
        const totalHeight = Math.max(crownY - feetY, 0.01);

        const faceY = crownY - totalHeight * FACE_CENTER_FRAC;
        const visibleHeight = totalHeight * VISIBLE_HEIGHT_FRAC;
        const fovRad = THREE.MathUtils.degToRad(camera.fov);
        const distance = (visibleHeight / 2) / Math.tan(fovRad / 2);

        camera.position.set(0, faceY, distance);
        camera.lookAt(0, faceY, 0);

        console.info(
          '[AvatarStage] framing → crownY:', crownY.toFixed(3),
          'feetY:', feetY.toFixed(3),
          'totalHeight:', totalHeight.toFixed(3),
          'faceY:', faceY.toFixed(3),
          'cameraDistance:', distance.toFixed(3),
          '— if the face is still cropped, raise FACE_CENTER_FRAC; if too',
          'zoomed in/out, adjust VISIBLE_HEIGHT_FRAC.'
        );

        // Re-aim the lights at the model's actual face height now that we
        // know it (VRM rigs vary in height/proportions).
        key.position.set(0.7, faceY + 0.6, 1.6);
        fill.position.set(-1.1, faceY, 1);
        rim.position.set(-0.6, faceY + 0.3, 0.9);

        setStatus('ready');
      },
      undefined,
      (err) => {
        console.error('[AvatarStage] failed to load VRM at', MODEL_URL, err);
        if (!cancelled) setStatus('error');
      }
    );

    // ── Keep the canvas sized to its wrapper ────────────────────────────
    const resize = () => {
      const w = wrap.clientWidth || 240;
      const h = wrap.clientHeight || 240;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ── Animation loop ───────────────────────────────────────────────────
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();
      const now = performance.now();

      if (vrm) {
        // Idle sway — subtle head turn/tilt, same feel as the old procedural
        // version, just applied to the VRM's actual head bone.
        const headBone = vrm.humanoid?.getNormalizedBoneNode('head');
        if (headBone && !prefersReducedMotion) {
          headBone.rotation.y = Math.sin(t * 0.55) * 0.05;
          headBone.rotation.x = Math.sin(t * 0.85) * 0.015;
        }

        const em = vrm.expressionManager;
        if (em) {
          // Blink, via the VRM expression manager instead of scaling meshes.
          if (now > blinkAt && blinkPhase === 0) blinkPhase = 0.001;
          if (blinkPhase > 0) {
            blinkPhase += 0.2;
            const closed = blinkPhase <= 1 ? Math.sin(blinkPhase * Math.PI) : 0;
            em.setValue('blink', closed);
            if (blinkPhase > 2) {
              blinkPhase = 0;
              blinkAt = now + 2500 + Math.random() * 3000;
              em.setValue('blink', 0);
            }
          }

          // Mouth openness from the last TTS word-boundary timestamp —
          // identical timing math to the procedural version, just driving
          // the 'aa' viseme expression instead of a jaw-pivot mesh.
          let openness = 0;
          if (modeRef.current === 'ammy-speaking') {
            const lastBoundary = mouthRef?.current || 0;
            const since = now - lastBoundary;
            const pulse = since < MOUTH_PULSE_MS ? 1 - since / MOUTH_PULSE_MS : 0;
            const flutter = 0.15 + Math.abs(Math.sin(t * 9)) * 0.1;
            openness = Math.max(pulse, flutter);
          }
          em.setValue('aa', openness);
          em.update();
        }

        vrm.update(dt); // required: drives spring bones, look-at, expressions
      }

      // Rim light color communicates state — same info the old rim light
      // carried (idle / listening / processing / speaking).
      const targetColor = MODE_COLOR[modeRef.current] ?? MODE_COLOR.idle;
      rim.color.lerp(new THREE.Color(targetColor), 0.08);

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode === wrap) {
        wrap.removeChild(renderer.domElement);
      }
      if (vrm) VRMUtils.deepDispose(vrm.scene);
      disposables.forEach((d) => d.dispose?.());
    };
    // Scene is built once; mode/mouthRef are read live via modeRef/ref-identity,
    // not captured — intentionally no deps here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="avatar-stage">
      {status === 'loading' && (
        <div className="avatar-stage-overlay avatar-stage-loading">Loading Ammy…</div>
      )}
      {status === 'error' && (
        <div className="avatar-stage-overlay avatar-stage-error">
          Couldn't load the avatar model.
          <br />
          Check that /models/ammy.vrm exists in your public folder.
        </div>
      )}
    </div>
  );
}
