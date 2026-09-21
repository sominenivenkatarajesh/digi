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
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Deep luxury navy-emerald gradient base
    const grad = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(0.7, '#0b1120');
    grad.addColorStop(1, '#050811');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Center circular badge for number
    ctx.beginPath();
    ctx.arc(256, 256, 140, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    // Metallic gold border
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    // Secondary inner ring
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(256, 256, 126, 0, Math.PI * 2);
    ctx.stroke();

    // Number text
    ctx.fillStyle = '#070b14';
    ctx.font = 'bold 130px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number).padStart(2, '0'), 256, 258);

    const tex = new THREE.CanvasTexture(canvas);
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

  // Dispersed starting offsets
  const startPos = useMemo<[number, number, number]>(() => {
    const angles = [0.2, 1.4, 2.8, 4.1, 5.2];
    const angle = angles[index % angles.length];
    const radius = 2.4;
    return [
      Math.cos(angle) * radius,
      Math.sin(angle) * 1.5 + (Math.random() - 0.5),
      (Math.random() - 0.5) * 2,
    ];
  }, [index]);

  const currentPos = useRef(new THREE.Vector3(...startPos));
  const currentRot = useRef(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0));

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const t = state.clock.getElapsedTime();
    const lerpSpeed = isSettled ? 3.5 : 1.5;

    if (reducedMotion) {
      meshRef.current.position.set(...targetPosition);
      meshRef.current.rotation.set(0, 0, 0);
      return;
    }

    if (isSettled) {
      // Settle smoothly into line
      const targetVec = new THREE.Vector3(
        targetPosition[0],
        targetPosition[1] + Math.sin(t * 2 + index * 0.8) * 0.08, // gentle hover
        targetPosition[2]
      );
      currentPos.current.lerp(targetVec, delta * lerpSpeed);

      // Rotate to face camera cleanly
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, delta * 3);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, 0, delta * 3);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(
        meshRef.current.rotation.z,
        Math.sin(t * 1.5 + index) * 0.05,
        delta * 2
      );
    } else {
      // Dynamic chaotic spin & float
      const floatVec = new THREE.Vector3(
        startPos[0] + Math.sin(t + index) * 0.4,
        startPos[1] + Math.cos(t * 1.2 + index) * 0.4,
        startPos[2]
      );
      currentPos.current.lerp(floatVec, delta * 1.5);

      meshRef.current.rotation.x += delta * (1.2 + index * 0.2);
      meshRef.current.rotation.y += delta * (1.5 - index * 0.1);
    }

    meshRef.current.position.copy(currentPos.current);
  });

  return (
    <mesh ref={meshRef} position={startPos} castShadow receiveShadow>
      <sphereGeometry args={[0.55, 32, 32]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.15}
        metalness={0.4}
        emissive="#059669"
        emissiveIntensity={0.12}
      />
    </mesh>
  );
}

export function DrawBalls({ isSettled = false }: { isSettled?: boolean }) {
  const perf = useDevicePerformance();
  const numbers = [7, 14, 21, 28, 35];

  // Settled row positions along X-axis
  const targetPositions: [number, number, number][] = [
    [-2.6, 0, 0],
    [-1.3, 0, 0],
    [0, 0, 0],
    [1.3, 0, 0],
    [2.6, 0, 0],
  ];

  return (
    <WebGLErrorBoundary fallbackTitle="Example Draw (Illustrative): 07 - 14 - 21 - 28 - 35">
      <div className="relative w-full h-[280px] sm:h-[340px] flex items-center justify-center">
        <Canvas
          camera={{ position: [0, 0, 5.5], fov: 42 }}
          dpr={[1, Math.min(perf.dpr, 2)]}
          gl={{ antialias: true, alpha: true }}
          className="w-full h-full"
        >
          <ambientLight intensity={1.0} />
          <directionalLight position={[4, 5, 4]} intensity={2.2} color="#ffffff" />
          <pointLight position={[-4, -3, -2]} intensity={1.2} color="#fbbf24" />
          <pointLight position={[0, -2, 3]} intensity={0.9} color="#34d399" />

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
