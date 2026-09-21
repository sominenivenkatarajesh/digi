'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDevicePerformance } from '@/hooks/useDevicePerformance';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';

function FloatingParticles({ count = 60 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, scales] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sc = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // distribute in a spherical shell around the center
      const r = 2.2 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      sc[i] = Math.random() * 1.5 + 0.5;
    }
    return [pos, sc];
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.04;
    pointsRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.02) * 0.1;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-scale"
          args={[scales, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#34d399"
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function GlowingOrb({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (meshRef.current) {
      if (!reducedMotion) {
        meshRef.current.rotation.y = t * 0.2;
        meshRef.current.rotation.x = Math.sin(t * 0.15) * 0.15;
      }
      // Gentle mouse parallax
      meshRef.current.position.x = THREE.MathUtils.lerp(
        meshRef.current.position.x,
        state.pointer.x * 0.35,
        0.05
      );
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        state.pointer.y * 0.35,
        0.05
      );
    }

    if (auraRef.current && !reducedMotion) {
      auraRef.current.rotation.y = -t * 0.15;
      auraRef.current.rotation.z = t * 0.1;
      const scale = 1 + Math.sin(t * 1.5) * 0.04;
      auraRef.current.scale.set(scale, scale, scale);
    }

    if (ringRef.current && !reducedMotion) {
      ringRef.current.rotation.z = t * 0.12;
      ringRef.current.rotation.x = Math.PI / 3 + Math.sin(t * 0.2) * 0.1;
    }
  });

  return (
    <group>
      {/* Inner Glowing Core */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.35, 4]} />
        <meshPhysicalMaterial
          color="#064e3b"
          emissive="#059669"
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.6}
          clearcoat={0.9}
          clearcoatRoughness={0.1}
          wireframe={false}
        />
      </mesh>

      {/* Crystalline wireframe lattice */}
      <mesh ref={auraRef}>
        <icosahedronGeometry args={[1.5, 2]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#d97706"
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* Orbital Gold Halo Ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.0, 0.015, 16, 64]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#fbbf24"
          emissiveIntensity={1.2}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

export function HeroScene() {
  const perf = useDevicePerformance();

  return (
    <WebGLErrorBoundary fallbackTitle="Digital Heroes Pulse">
      <div className="relative w-full h-full min-h-[420px] lg:min-h-[560px] flex items-center justify-center pointer-events-auto">
        <Canvas
          camera={{ position: [0, 0, 5.2], fov: 45 }}
          dpr={[1, Math.min(perf.dpr, 2)]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          className="w-full h-full"
        >
          <ambientLight intensity={0.8} />
          <pointLight position={[5, 6, 5]} intensity={1.8} color="#fef08a" />
          <pointLight position={[-5, -4, -3]} intensity={1.5} color="#34d399" />
          <pointLight position={[0, -5, 2]} intensity={0.9} color="#059669" />

          <GlowingOrb reducedMotion={perf.reducedMotion} />
          <FloatingParticles count={perf.particleCount} />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}

export default HeroScene;
