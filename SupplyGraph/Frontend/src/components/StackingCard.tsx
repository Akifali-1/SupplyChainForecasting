import React, { useMemo } from 'react';
import { motion, MotionValue, useTransform } from 'framer-motion';

interface StackingCardProps {
  index: number;
  totalCards: number;
  scrollYProgress: MotionValue<number>;
  children: React.ReactNode;
}

export const StackingCard: React.FC<StackingCardProps> = ({ 
  index, 
  totalCards, 
  scrollYProgress, 
  children 
}) => {
  // We divide the active scrolling area into equal intervals for card stacking
  const { inputRange, outputRange, opacityOutputRange } = useMemo(() => {
    const activeRange = 0.8;
    const stepSize = activeRange / (totalCards - 1 || 1);

    const inputRange: number[] = [];
    const outputRange: number[] = [];
    const opacityOutputRange: number[] = [];

    for (let k = 0; k < totalCards; k++) {
      const progress = k * stepSize;
      inputRange.push(progress);

      if (k <= index) {
        outputRange.push(1);
        opacityOutputRange.push(1);
      } else {
        const factor = k - index;
        outputRange.push(Math.max(0.85, 1 - factor * 0.03));
        opacityOutputRange.push(Math.max(0.5, 1 - factor * 0.15));
      }
    }

    if (inputRange[inputRange.length - 1] < 1) {
      inputRange.push(1);
      outputRange.push(outputRange[outputRange.length - 1]);
      opacityOutputRange.push(opacityOutputRange[opacityOutputRange.length - 1]);
    }

    return { inputRange, outputRange, opacityOutputRange };
  }, [index, totalCards]); // index and totalCards never change after mount

  const scale = useTransform(scrollYProgress, inputRange, outputRange);
  const opacity = useTransform(scrollYProgress, inputRange, opacityOutputRange);

  return (
    <motion.div
      className="sticky w-full"
      style={{
        scale,
        opacity,
        // Framer Motion manages will-change internally — don't double-declare it
        zIndex: index + 1,
        top: `calc(6.5rem + ${index * 28}px)`,
        marginBottom: '50vh',
      }}
    >
      {children}
    </motion.div>
  );
};

export default StackingCard;

