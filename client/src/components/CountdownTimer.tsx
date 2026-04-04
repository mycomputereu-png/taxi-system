import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  initialSeconds: number;
  onComplete?: () => void;
}

export function CountdownTimer({ initialSeconds, onComplete }: CountdownTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setRemainingSeconds(initialSeconds);
    setIsActive(true);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isActive || remainingSeconds <= 0) {
      if (remainingSeconds <= 0 && onComplete) {
        onComplete();
      }
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsActive(false);
          if (onComplete) onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, remainingSeconds, onComplete]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  // Color based on remaining time
  const getColor = () => {
    if (remainingSeconds > 300) return "text-green-400"; // > 5 minutes
    if (remainingSeconds > 120) return "text-yellow-400"; // > 2 minutes
    if (remainingSeconds > 60) return "text-orange-400"; // > 1 minute
    return "text-red-500"; // < 1 minute
  };

  // Scale animation based on urgency
  const getScale = () => {
    if (remainingSeconds <= 60) return "scale-110";
    return "scale-100";
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
        <Clock className="w-4 h-4" />
        <span>Șoferul vine în:</span>
      </div>
      
      <div
        className={`
          relative flex items-center justify-center
          w-32 h-32 rounded-full
          bg-gradient-to-br from-slate-800 to-slate-900
          border-2 transition-all duration-300 ease-out
          ${remainingSeconds > 120 ? "border-green-500" : ""}
          ${remainingSeconds <= 120 && remainingSeconds > 60 ? "border-yellow-500" : ""}
          ${remainingSeconds <= 60 && remainingSeconds > 0 ? "border-orange-500" : ""}
          ${remainingSeconds === 0 ? "border-red-500" : ""}
          ${getScale()}
          shadow-lg
        `}
      >
        {/* Animated pulse ring */}
        {remainingSeconds <= 60 && remainingSeconds > 0 && (
          <div
            className={`
              absolute inset-0 rounded-full border-2
              ${remainingSeconds <= 30 ? "border-red-500" : "border-orange-500"}
              animate-pulse
            `}
          />
        )}

        {/* Timer display */}
        <div className="flex flex-col items-center">
          <div className={`text-4xl font-bold font-mono transition-colors duration-300 ${getColor()}`}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          <div className="text-xs text-gray-400 mt-1">min:sec</div>
        </div>
      </div>

      {/* Status message */}
      <div className="text-xs text-gray-400 text-center mt-2">
        {remainingSeconds === 0 ? (
          <span className="text-green-400 font-medium">Șoferul a sosit!</span>
        ) : remainingSeconds <= 60 ? (
          <span className="text-orange-400">Sosire iminent</span>
        ) : remainingSeconds <= 300 ? (
          <span className="text-yellow-400">Șoferul se apropie</span>
        ) : (
          <span>Așteptare...</span>
        )}
      </div>
    </div>
  );
}
