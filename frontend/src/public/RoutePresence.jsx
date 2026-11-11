import { AnimatePresence } from 'framer-motion';

export default function RoutePresence({ children }) {
  return <AnimatePresence mode="wait">{children}</AnimatePresence>;
}
