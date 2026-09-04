import { motion } from "framer-motion";

export const Greeting = () => (
  <div
    className="mx-auto mt-8 flex size-full max-w-2xl flex-col items-center justify-center px-4 md:mt-20"
    key="overview"
  >
    <motion.div
      animate={{ opacity: 1 }}
      initial={{ opacity: 0 }}
      transition={{ delay: 0.2 }}
    >
      <img
        alt="Gemeente Den Haag"
        className="mb-6 size-12 md:size-14"
        height={56}
        src="/images/Compact_Logo_gemeente_Den_Haag.svg"
        width={56}
      />
    </motion.div>
    <motion.h1
      animate={{ opacity: 1, y: 0 }}
      className="text-center font-semibold text-2xl md:text-3xl"
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.3 }}
    >
      Hoe kan ik u helpen?
    </motion.h1>
    <motion.p
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 max-w-sm text-center text-muted-foreground text-sm md:text-base"
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.4 }}
    >
      Stel een vraag over stadslandbouw en voedselbeleid in Den Haag
    </motion.p>
  </div>
);
