'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDevicePerformance } from '@/hooks/useDevicePerformance';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';

interface BallProps {
  number: number;
  targetPosition: [number, number, number];
  isSettled: boolean;
  index: number;
  reducedMotion: boolean;
}

function BallTexture({ number }: { number: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Deep luxury emerald gradient base
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(0.25, '#047857');
    grad.addColorStop(0.5, '#064e3b');
    grad.addColorStop(0.75, '#047857');
    grad.addColorStop(1, '#064e3b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Subtle horizontal metallic sheen lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let y = 30; y < 480; y += 40) {
      ctx.fillRect(0, y, 1024, 8);
    }

    // Function to draw circular badge and number
    // In Three.js SphereGeometry:
    // u = 0.25 (canvas X = 256) corresponds to +Z (facing the camera directly!)
    // u = 0.75 (canvas X = 768) corresponds to -Z (facing the back)
    const drawBadge = (cx: number, cy: number) => {
      // Outer gold glow ring
      ctx.beginPath();
      ctx.arc(cx, cy, 116, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.fill();

      // Outer metallic gold ring
      ctx.beginPath();
      ctx.arc(cx, cy, 110, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      // Inner gold bevel
      ctx.beginPath();
      ctx.arc(cx, cy, 104, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();

      // Core white porcelain disc
      ctx.beginPath();
      ctx.arc(cx, cy, 98, 0, Math.PI * 2);
      const discGrad = ctx.createRadialGradient(cx - 20, cy - 20, 10, cx, cy, 98);
      discGrad.addColorStop(0, '#ffffff');
      discGrad.addColorStop(0.85, '#f1f5f9');
      discGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = discGrad;
      ctx.fill();

      // Subtle inner rim border
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      // Bold centered number text
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 86px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number).padStart(2, '0'), cx, cy + 2);
    };

    // Front face (facing +Z straight to camera): cx = 256, cy = 256
    drawBadge(256, 256);

    // Back face (facing -Z): cx = 768, cy = 256
    drawBadge(768, 256);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [number]);

  return texture;
}

function SingleBall({
  number,
  targetPosition,
  isSettled,
  index,
  reducedMotion,
}: BallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = BallTexture({ number });

  // Dispersed starting positions
  const startPos = useMemo<[number, number, number]>(() => {
    const angles = [0.2, 1.4, 2.8, 4.1, 5.2];
    const angle = angles[index % angles.length];
    const radius = 2.0;
    return [
      Math.cos(angle) * radius,
      Math.sin(angle) * 0.8,
      (Math.random() - 0.5) * 1.0,
    ];
  }, [index]);

  const currentPos = useRef(new THREE.Vector3(...startPos));

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const t = state.clock.getElapsedTime();

    if (reducedMotion) {
      meshRef.current.position.set(...targetPosition);
      meshRef.current.rotation.set(0, 0, 0);
      return;
    }

    if (isSettled) {
      // Smoothly settle into alignment with gentle floating hover
      const targetVec = new THREE.Vector3(
        targetPosition[0],
        targetPosition[1] + Math.sin(t * 2.2 + index * 0.9) * 0.05,
        targetPosition[2]
      );
      currentPos.current.lerp(targetVec, delta * 3.5);

      // Face camera cleanly: (0, 0, 0) maps u=0.25 directly facing +Z
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, delta * 4);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, 0, delta * 4);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(
        meshRef.current.rotation.z,
        Math.sin(t * 1.5 + index) * 0.03,
        delta * 3
      );
    } else {
      // Dynamic floating spin before settling
      const floatVec = new THREE.Vector3(
        startPos[0] + Math.sin(t + index) * 0.25,
        startPos[1] + Math.cos(t * 1.2 + index) * 0.25,
        startPos[2]
      );
      currentPos.current.lerp(floatVec, delta * 2.0);

      meshRef.current.rotation.x += delta * (0.8 + index * 0.1);
      meshRef.current.rotation.y += delta * (1.0 - index * 0.1);
    }

    meshRef.current.position.copy(currentPos.current);
  });

  return (
    <mesh ref={meshRef} position={startPos} castShadow receiveShadow>
      <sphereGeometry args={[0.46, 48, 48]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.16}
        metalness={0.32}
        emissive="#064e3b"
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}

export function FallbackBalls() {
  const numbers = [7, 14, 21, 28, 35];
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-5 py-4">
      {numbers.map((num) => (
        <div
          key={num}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-emerald-600 via-emerald-800 to-navy-950 p-1 shadow-lg shadow-emerald-950/60 border border-gold-400/50 flex items-center justify-center transform transition-transform hover:scale-105"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-white to-slate-200 border-2 border-gold-400 flex items-center justify-center shadow-inner">
            <span className="font-mono font-black text-navy-950 text-sm sm:text-base">
              {String(num).padStart(2, '0')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DrawBalls({ isSettled = false }: { isSettled?: boolean }) {
  const perf = useDevicePerformance();
  const numbers = [7, 14, 21, 28, 35];

  // Settled row positions along X-axis
  const targetPositions: [number, number, number][] = [
    [-2.0, 0, 0],
    [-1.0, 0, 0],
    [0, 0, 0],
    [1.0, 0, 0],
    [2.0, 0, 0],
  ];

  return (
    <WebGLErrorBoundary fallback={<FallbackBalls />}>
      <div className="relative w-full h-[180px] sm:h-[210px] flex items-center justify-center">
        <Canvas
          camera={{ position: [0, 0, 4.3], fov: 36 }}
          dpr={[1, Math.min(perf.dpr, 2)]}
          gl={{ antialias: true, alpha: true }}
          className="w-full h-full"
        >
          <ambientLight intensity={1.1} />
          <directionalLight position={[4, 5, 4]} intensity={2.4} color="#ffffff" />
          <pointLight position={[-3, -2, 2]} intensity={1.2} color="#fbbf24" />
          <pointLight position={[0, 3, 2]} intensity={1.0} color="#34d399" />

          <group position={[0, 0, 0]}>
            {numbers.map((num, i) => (
              <SingleBall
                key={num}
                number={num}
                index={i}
                targetPosition={targetPositions[i]}
                isSettled={isSettled}
                reducedMotion={perf.reducedMotion}
              />
            ))}
          </group>
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}

export default DrawBalls;
