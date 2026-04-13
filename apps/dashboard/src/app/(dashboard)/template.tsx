'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Template runs on EVERY navigation (unlike layout which persists).
 * This gives us a smooth cinematic fade+slide transition between pages — 
 * feels like an iOS native app.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{
          duration: 0.2,
          ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad — smooth, not bouncy
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
