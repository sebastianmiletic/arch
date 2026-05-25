import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 2500),
      setTimeout(() => onComplete(), 3200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ backgroundColor: '#08080a' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: phase >= 4 ? 0 : 1 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      <div className="flex flex-col items-center">
        {/* Logo image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src="/logo.png"
            alt="Arch"
            width={120}
            height={126}
            className="shrink-0"
            draggable={false}
          />
        </motion.div>

        {/* Text sliding out from behind logo */}
        <motion.div
          className="mt-4 overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={phase >= 2 ? { height: 'auto', opacity: 1 } : {}}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.span
            className="block text-3xl font-semibold tracking-tight text-white"
            style={{ letterSpacing: '-0.02em' }}
            initial={{ y: 20 }}
            animate={phase >= 2 ? { y: 0 } : {}}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            Arch
          </motion.span>
        </motion.div>

        {/* Purple loading bar */}
        <motion.div
          className="mt-5 w-24 h-px overflow-hidden rounded-full"
          style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)' }}
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : {}}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: '#a855f7' }}
            initial={{ width: '0%' }}
            animate={phase >= 3 ? { width: '100%' } : phase >= 2 ? { width: '30%' } : {}}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
