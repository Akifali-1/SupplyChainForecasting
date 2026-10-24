import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '../contexts/ThemeContext';

const WaveBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const isDarkRef = useRef(theme === 'dark');

  useEffect(() => {
    isDarkRef.current = theme === 'dark';
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    // Full-resolution WebGL is expensive on high-DPI screens and does not
    // materially improve this decorative background.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1 : 1.5));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      40,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100
    );
    camera.position.set(0.0, 4.2, 9.5);
    camera.lookAt(0.0, -0.3, 0.0);

    // 72 Continuous Topographical Demand Horizon Ribbons (Zero Particles)
    const NUM_LINES = 72;
    const SEGMENTS = 220;
    const WIDTH = 22;
    const DEPTH = 11;

    const totalVertices = NUM_LINES * SEGMENTS;
    const positions = new Float32Array(totalVertices * 3);
    const lineIndices = new Float32Array(totalVertices);
    const uvs = new Float32Array(totalVertices * 2);
    const indices: number[] = [];

    let vIdx = 0;
    for (let l = 0; l < NUM_LINES; l++) {
      const v = l / (NUM_LINES - 1);
      const z = (v - 0.5) * DEPTH;

      for (let s = 0; s < SEGMENTS; s++) {
        const u = s / (SEGMENTS - 1);
        const x = (u - 0.5) * WIDTH;

        positions[vIdx * 3] = x;
        positions[vIdx * 3 + 1] = 0;
        positions[vIdx * 3 + 2] = z;

        lineIndices[vIdx] = v;
        uvs[vIdx * 2] = u;
        uvs[vIdx * 2 + 1] = v;

        if (s < SEGMENTS - 1) {
          indices.push(vIdx, vIdx + 1);
        }
        vIdx++;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aLineIndex', new THREE.BufferAttribute(lineIndices, 1));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(2.5, 0.0) },
      uIsDark: { value: isDarkRef.current ? 1.0 : 0.0 },
      uColorPrimary: { value: new THREE.Color('#00B4D8') },
      uColorSecondary: { value: new THREE.Color('#6366F1') },
      uColorPeak: { value: new THREE.Color('#E0F2FE') },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: isDarkRef.current ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform vec2 uMouse;
        attribute float aLineIndex;
        varying float vElevation;
        varying vec2 vUv;
        varying float vTextZoneMask;
        varying float vPulse;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Multi-horizon spatio-temporal wave interference (smooth silk manifold)
          float w1 = sin(pos.x * 0.48 + uTime * 0.55 + pos.z * 0.35) * 0.55;
          float w2 = cos(pos.x * 0.28 - uTime * 0.38 + pos.z * 0.65) * 0.42;
          float w3 = sin(pos.x * 0.85 + pos.z * 0.9 + uTime * 0.7) * 0.18;

          // Interactive cursor gravity well / peak
          float distToMouse = length(pos.xz - uMouse);
          float mouseWave = exp(-distToMouse * distToMouse * 0.18) * 0.95;

          // Rise smoothly toward the right side of the screen (forecast horizon)
          float horizonSlope = smoothstep(-6.0, 7.0, pos.x) * 0.85;

          pos.y = (w1 + w2 + w3) * (0.45 + horizonSlope * 0.65) + mouseWave + horizonSlope * 0.5 - 0.6;

          vElevation = clamp((pos.y + 1.2) / 2.6, 0.0, 1.0);

          // Traveling forecast signal pulse along the x-axis
          float pulsePos = mod(uTime * 0.28 + aLineIndex * 0.35, 1.4) - 0.2;
          vPulse = smoothstep(0.18, 0.0, abs(uv.x - pulsePos));

          // Softly dim the lines directly behind the left-middle headline so text is 100% legible
          vec2 textCenter = vec2(-4.8, 0.8);
          float textDist = length((pos.xz - textCenter) * vec2(0.32, 0.55));
          vTextZoneMask = smoothstep(0.65, 2.2, textDist);

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uIsDark;
        uniform vec3 uColorPrimary;
        uniform vec3 uColorSecondary;
        uniform vec3 uColorPeak;
        varying float vElevation;
        varying vec2 vUv;
        varying float vTextZoneMask;
        varying float vPulse;

        void main() {
          // Smooth edge vignette so lines fade into infinity at all 4 borders
          float edgeX = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
          float edgeZ = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
          float vignette = edgeX * edgeZ;

          // Blend from deep indigo in valleys to cyan on slopes to ice-white on peaks
          vec3 baseCol = mix(uColorSecondary, uColorPrimary, smoothstep(0.15, 0.7, vElevation));
          baseCol = mix(baseCol, uColorPeak, smoothstep(0.68, 1.0, vElevation) * 0.75 + vPulse * 0.55);

          // In Light Mode, shift to deeper slate/cobalt so lines contrast cleanly on white
          vec3 lightModeCol = mix(vec3(0.28, 0.33, 0.45), vec3(0.01, 0.52, 0.78), vElevation);
          vec3 finalCol = mix(lightModeCol, baseCol, uIsDark);

          // Emphasize every 6th contour line as a primary "isoline"
          float isMajorLine = step(0.84, fract(vUv.y * 12.0));
          float baseAlpha = mix(0.22, 0.58, isMajorLine) + vPulse * 0.35 + vElevation * 0.2;

          float alpha = baseAlpha * vignette * mix(0.22, 1.0, vTextZoneMask);
          if (uIsDark < 0.5) {
            alpha *= 0.65;
          }

          gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 0.88));
        }
      `,
    });

    const linesMesh = new THREE.LineSegments(geometry, material);
    scene.add(linesMesh);

    // Smooth cursor projection onto the y=0 plane
    const raycaster = new THREE.Raycaster();
    const ndcMouse = new THREE.Vector2(0.35, 0.0);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3(2.5, 0, 0);
    const smoothedMouse = new THREE.Vector2(2.5, 0);

    const onMouseMove = (e: MouseEvent) => {
      ndcMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndcMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const onResize = () => {
      if (!canvas) return;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener('resize', onResize, { passive: true });

    const clock = new THREE.Clock();
    let rafId = 0;
    let isIntersecting = true;
    let isLoopRunning = false;

    const tick = () => {
      if (!isLoopRunning) return;
      rafId = requestAnimationFrame(tick);

      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;
      uniforms.uIsDark.value = isDarkRef.current ? 1.0 : 0.0;
      material.blending = isDarkRef.current ? THREE.AdditiveBlending : THREE.NormalBlending;

      raycaster.setFromCamera(ndcMouse, camera);
      raycaster.ray.intersectPlane(groundPlane, hitPoint);

      const clampedX = Math.max(-8, Math.min(8, hitPoint.x));
      const clampedZ = Math.max(-4.5, Math.min(4.5, hitPoint.z));
      smoothedMouse.x += (clampedX - smoothedMouse.x) * 0.06;
      smoothedMouse.y += (clampedZ - smoothedMouse.y) * 0.06;
      uniforms.uMouse.value.copy(smoothedMouse);

      // Subtle camera breathing
      camera.position.x += (ndcMouse.x * 0.45 - camera.position.x) * 0.03;
      camera.position.y += (4.2 + ndcMouse.y * 0.25 - camera.position.y) * 0.03;
      camera.lookAt(0.2, -0.35, 0.0);

      renderer.render(scene, camera);
    };

    const syncLoopState = () => {
      const shouldRun = isIntersecting && !document.hidden;
      if (shouldRun && !isLoopRunning) {
        isLoopRunning = true;
        tick();
      } else if (!shouldRun && isLoopRunning) {
        isLoopRunning = false;
        cancelAnimationFrame(rafId);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        syncLoopState();
      },
      { threshold: 0 }
    );
    observer.observe(canvas);
    document.addEventListener('visibilitychange', syncLoopState);
    syncLoopState();

    return () => {
      isLoopRunning = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', syncLoopState);
      observer.disconnect();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, transform: 'translateZ(0)' }}
    />
  );
};

export default WaveBackground;
