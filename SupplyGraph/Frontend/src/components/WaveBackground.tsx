import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * WaveBackground
 * ─────────────
 * Optimized Three.js GPU particle wave — always in the "settled" state (uMorph = 1).
 * The wave breathes gently via sin(time) in the vertex shader, and responds
 * to mouse position by tilting the camera target slightly.
 *
 * Color palette: white → pink → purple (no green).
 */
const WaveBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // Disabling antialiasing saves substantial fragment shading resources
      alpha: true,
      powerPreference: 'high-performance', // Request dedicated GPU if available
      precision: 'mediump', // Use medium precision for faster math calculations
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // Capped at 1.5 to reduce Retina fill-rate bottleneck
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 3.4, 6);

    // ── Geometry ────────────────────────────────────────────────────────────
    const N = 35000; // Increased to 35,000 for ultra-dense premium spotlight details
    const W = 16;
    const D = 9;

    const orderA  = new Float32Array(N * 3);
    const chaosA  = new Float32Array(N * 3); // kept but unused (uMorph = 1)
    const sclA    = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3()
        .randomDirection()
        .multiplyScalar(2 + Math.pow(Math.random(), 0.5) * 7);
      chaosA.set([v.x, v.y * 0.7, v.z], i * 3);

      const x = (Math.random() - 0.5) * W;
      const z = (Math.random() - 0.5) * D;
      const y =
        Math.sin(x * 0.9) * 0.7 +
        Math.sin(x * 2.2 + z) * 0.3 +
        Math.cos(z * 1.6) * 0.35 +
        x * 0.09;

      orderA.set([x, y, z], i * 3);
      sclA[i] = 0.4 + Math.random() * 1.5; // Slightly larger range to compensate for lower count
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(chaosA, 3));
    geo.setAttribute('aOrder',   new THREE.BufferAttribute(orderA, 3));
    geo.setAttribute('aScale',   new THREE.BufferAttribute(sclA,   1));

    // ── Uniforms — cyan / deep-blue / white-cyan palette ─────────────────────
    const uniforms = {
      uTime:        { value: 0 },
      uMorph:       { value: 1 },                              // always settled
      uSize:        { value: 20 * renderer.getPixelRatio() },  // Optimized size for 35k particles density
      uIn:          { value: new THREE.Color('#d8faff') },     // bright white-cyan (peaks)
      uMid:         { value: new THREE.Color('#00f0ff') },     // vivid neon cyan (mid)
      uOut:         { value: new THREE.Color('#0022cc') },     // deep electric blue (valleys)
      uScan:        { value: -W / 2 },
      uMouseWorld:  { value: new THREE.Vector3(0, 0, 0) },     // Projected mouse world coordinate
      uMouseActive: { value: 0.0 },                            // Dynamic reveal opacity
      uMouseRadius: { value: 3.8 },                            // Spotlight reach radius
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uMorph, uSize, uScan;
        uniform vec3  uIn, uMid, uOut;
        uniform vec3  uMouseWorld;
        uniform float uMouseActive;
        uniform float uMouseRadius;

        attribute vec3  aOrder;
        attribute float aScale;

        varying vec3  vColor;
        varying float vGlow;
        varying float vVisibility;

        float hash(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }

        void main() {
          // Settled wave with gentle time-driven ripple
          vec3 wave = aOrder;
          wave.y += sin(uTime * 1.4 + aOrder.x * 1.2 + aOrder.z) * 0.12 * uMorph;

          vec4 mv = modelViewMatrix * vec4(wave, 1.0);
          gl_Position  = projectionMatrix * mv;
          
          // Clamp Point Size to prevent massive overdraw/fill-rate spikes when particles get near the camera
          gl_PointSize = clamp(uSize * aScale / (-mv.z), 1.0, 48.0);

          // Tri-color gradient: valley = deep blue, mid = cyan, peak = white-cyan
          // Adjust height threshold based on x coordinate to pull more dark blue onto the rising right side
          float heightAdjust = wave.x * 0.15;
          float t = clamp((wave.y - heightAdjust + 1.6) / 3.2, 0.0, 1.0);
          
          // Split at 0.6 (favoring dark blue for 60% of height) and apply power curve to bias the blend
          vec3 col = t < 0.6
            ? mix(uOut, uMid, pow(t / 0.6, 1.3))
            : mix(uMid, uIn,  (t - 0.6) / 0.4);
          vColor = col;

          // Scan-line glow
          vGlow = 1.0 - smoothstep(0.0, 1.4, abs(wave.x - uScan));

          // Interactive spotlight reveal around mouse
          float dist = distance(wave.xz, uMouseWorld.xz);
          float reveal = 1.0 - smoothstep(0.4, uMouseRadius, dist);
          
          // Ambient visibility is very low (0.01) so wave is barely trace-visible in the dark
          vVisibility = mix(0.01, 1.0, reveal) * uMouseActive;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3  vColor;
        varying float vGlow;
        varying float vVisibility;

        void main() {
          // Discard fragments outside the spotlight to completely skip GPU blending and pixel write operations
          if (vVisibility < 0.015) {
            discard;
          }
          float a = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
          // Add cyan-white shimmer at glow peaks
          vec3 c = vColor + vec3(0.85, 0.98, 1.0) * vGlow * 0.65;
          gl_FragColor  = vec4(c, a * a * 0.88 * vVisibility);
        }
      `,
    });

    scene.add(new THREE.Points(geo, material));

    // ── Stars (soft purple-tinted) ──────────────────────────────────────────
    const starCount = 400; // Reduced from 2,000 to 400 to save processing
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const v = new THREE.Vector3()
        .randomDirection()
        .multiplyScalar(22 + Math.random() * 26);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          size: 0.04,
          color: '#a5f3fc', // cyan-tinted stars matching the new palette
          transparent: true,
          opacity: 0.4,
        })
      )
    );

    // ── Mouse & Raycast Tracking ────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const ndcMouse = new THREE.Vector2(0, 0); // Start NDC mouse at center
    const targetPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Flat wave sheet at y = 0
    const intersectionPoint = new THREE.Vector3(0, 0, 0);
    const mouseWorld = new THREE.Vector3(0, 0, 0);
    let mouseActive = 0.0;
    let mouseActiveTarget = 1.0; // Spotlight fades in on mount and stays active
    let mouseInfluence = 0.0;
    let mouseInfluenceTarget = 0.0; // Starts at 0 (idle center orbit active)
    let mouseInWindow = false; // Tracks if mouse is actively inside the window

    const onMouseMove = (e: MouseEvent) => {
      ndcMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndcMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseInWindow = true;
    };

    const onMouseLeave = () => {
      mouseInWindow = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        ndcMouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        ndcMouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
        mouseInWindow = true;
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    window.addEventListener('touchstart', onTouchMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onMouseLeave, { passive: true });

    // ── Resize ──────────────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener('resize', onResize, { passive: true });

    // ── Visibility & Intersection Guards ────────────────────────────────────
    let tabVisible = !document.hidden;
    let elementIntersecting = true;

    const onVisibility = () => { tabVisible = !document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);

    const observer = new IntersectionObserver(
      ([entry]) => {
        elementIntersecting = entry.isIntersecting;
      },
      { threshold: 0 } // Triggers immediately when any part enters/leaves the viewport
    );
    observer.observe(canvas);

    // ── Render loop ─────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let rafId = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      
      // Stop rendering work entirely if tab is hidden or canvas is scrolled out of view
      if (!tabVisible || !elementIntersecting) return;

      const t = clock.getElapsedTime();
      uniforms.uTime.value  = t;
      uniforms.uScan.value  = ((t * 2.0) % (W + 6)) - (W / 2 + 3);

      // Perform camera raycasting to project screen coordinates to y=0 world plane
      raycaster.setFromCamera(ndcMouse, camera);
      raycaster.ray.intersectPlane(targetPlane, intersectionPoint);

      // Idle orbit animation shifted slightly to the left-middle (behind the text area)
      const centerAnimX = -2.5 + Math.sin(t * 0.4) * 1.5;
      const centerAnimZ = Math.cos(t * 0.3) * 0.6;

      // Check if projected mouse coordinate falls inside active wave bounds
      const isInsideWave =
        intersectionPoint.x >= -9.0 &&
        intersectionPoint.x <= 9.0 &&
        intersectionPoint.z >= -5.5 &&
        intersectionPoint.z <= 5.5;

      // Spotlight follows mouse only if it is inside the viewport AND within the wave bounds
      mouseInfluenceTarget = (mouseInWindow && isInsideWave) ? 1.0 : 0.0;

      // Smoothly blend between idle orbit and cursor coordinates
      mouseInfluence += (mouseInfluenceTarget - mouseInfluence) * 0.05;
      
      const targetX = THREE.MathUtils.lerp(centerAnimX, intersectionPoint.x, mouseInfluence);
      const targetZ = THREE.MathUtils.lerp(centerAnimZ, intersectionPoint.z, mouseInfluence);

      // Smoothly chase the blended coordinates (with physics-damping inertia)
      mouseWorld.x += (targetX - mouseWorld.x) * 0.08;
      mouseWorld.z += (targetZ - mouseWorld.z) * 0.08;
      uniforms.uMouseWorld.value.copy(mouseWorld);

      // Elegant spotlight fade-in on mount
      mouseActive += (mouseActiveTarget - mouseActive) * 0.03;
      uniforms.uMouseActive.value = mouseActive;

      // Gentle camera look-at drift from mouse coordinates (scaled for subtlety)
      camera.lookAt(ndcMouse.x * 0.3, 0.4 + ndcMouse.y * 0.15, 0);

      renderer.render(scene, camera);
    };

    tick();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('touchstart', onTouchMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseLeave);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      renderer.dispose();
      geo.dispose();
      material.dispose();
      starGeo.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0, pointerEvents: 'none', transform: 'translateZ(0)' }}
    />
  );
};

export default WaveBackground;
