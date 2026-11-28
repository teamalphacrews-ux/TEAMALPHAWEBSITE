import React from 'react';
import { motion as Motion } from 'framer-motion';

const PageTransition = ({ children }) => {
  return (
    <Motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      {children}
    </Motion.div>
  );
};

export default PageTransition;
