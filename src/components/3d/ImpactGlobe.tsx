'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDevicePerformance } from '@/hooks/useDevicePerformance';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';

function DottedSphere({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const hotSpotsRef = useRef<THREE.Group>(null);

  // Generate dotted globe grid
  const [positions] = useMemo(() => {
    const coords: number[] = [];
    const count = 450;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;

      const r = 1.6;
      coords.push(
        r * Math.cos(theta) * Math.sin(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(phi)
      );
    }
    return [new Float32Array(coords)];
  }, []);

  // Glowing impact charity node locations
  const nodes = useMemo(() => {
    return [
      { pos: [1.2, 0.8, 0.7] as [number, number, number], color: '#34d399' },
      { pos: [-0.9, 1.1, 0.6] as [number, number, number], color: '#fbbf24' },
      { pos: [0.3, -1.2, 0.9] as [number, number, number], color: '#34d399' },
      { pos: [-1.3, -0.4, 0.8] as [number, number, number], color: '#fbbf24' },
      { pos: [0.8, -0.6, -1.1] as [number, number, number], color: '#34d399' },
    ];
  }, []);

  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.getElapsedTime();
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.12;
    }
    if (hotSpotsRef.current) {
      hotSpotsRef.current.rotation.y = t * 0.12;
    }
  });

  return (
    <group>
      {/* Globe particle dots */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.045}
          color="#10b981"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </points>

      {/* Internal core glow */}
      <mesh>
        <sphereGeometry args={[1.45, 24, 24]} />
        <meshBasicMaterial
          color="#064e3b"
          transparent
          opacity={0.15}
          wireframe
        />
      </mesh>

      {/* Pulsing charity impact hot spots */}
      <group ref={hotSpotsRef}>
        {nodes.map((node, i) => (
          <mesh key={i} position={node.pos}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshBasicMaterial color={node.color} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function ImpactGlobe() {
  const perf = useDevicePerformance();

  return (
    <WebGLErrorBoundary fallbackTitle="Global Impact Visualization">
      <div className="relative w-full h-[220px] sm:h-[260px] flex items-center justify-center">
        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 45 }}
          dpr={[1, Math.min(perf.dpr, 1.5)]}
          gl={{ antialias: true, alpha: true }}
          className="w-full h-full"
        >
          <ambientLight intensity={1} />
          <DottedSphere reducedMotion={perf.reducedMotion} />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}

export default ImpactGlobe;
