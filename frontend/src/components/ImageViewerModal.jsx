import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { haptics } from '../utils/haptics';

const ImageViewerModal = ({ images = [], initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef(null);

  // Scroll event for snapping synchronization
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        const scrollPosition = scrollRef.current.scrollLeft;
        const slideWidth = scrollRef.current.clientWidth;
        const newIndex = Math.round(scrollPosition / slideWidth);
        if (newIndex !== currentIndex && newIndex >= 0 && newIndex < images.length) {
          setCurrentIndex(newIndex);
        }
      }
    };

    const container = scrollRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [currentIndex, images.length]);

  // Initial scroll to the initial index
  useEffect(() => {
    if (scrollRef.current && initialIndex > 0) {
      scrollRef.current.scrollLeft = initialIndex * scrollRef.current.clientWidth;
    }
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [initialIndex]);

  const scrollToSlide = (index) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: index * scrollRef.current.clientWidth,
        behavior: 'smooth'
      });
      setCurrentIndex(index);
      haptics.light();
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentIndex < images.length - 1) {
      scrollToSlide(currentIndex + 1);
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      scrollToSlide(currentIndex - 0); // Wait, currentIndex - 1
    }
  };

  // Fix handlePrev logic
  const handlePrevClick = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      scrollToSlide(currentIndex - 1);
    }
  }

  if (!images || images.length === 0) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 px-4 pb-4 pt-safe flex items-center justify-between z-[101] bg-gradient-to-b from-black/60 to-transparent">
        <div className="text-white/80 font-medium text-sm">
          {currentIndex + 1} / {images.length}
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-full text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content - Swipeable Container */}
      <div 
        ref={scrollRef}
        className="flex-1 w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {images.map((img, idx) => (
          <div 
            key={idx} 
            className="min-w-full w-full h-full shrink-0 flex items-center justify-center p-4 snap-center relative group"
          >
            <img 
              src={img.url || img} 
              alt={`Rasm ${idx + 1}`} 
              className="max-w-full max-h-[85dvh] object-contain rounded-lg shadow-2xl transition-transform duration-300"
            />
          </div>
        ))}
      </div>

      {/* Desktop Navigation Arrows (hidden on mobile) */}
      {images.length > 1 && (
        <>
          <button 
            onClick={handlePrevClick}
            disabled={currentIndex === 0}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white disabled:opacity-0 transition-all z-[101]"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={handleNext}
            disabled={currentIndex === images.length - 1}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white disabled:opacity-0 transition-all z-[101]"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Mobile Pagination Indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-2 z-[101]">
          {images.map((_, idx) => (
            <div 
              key={idx}
              className={`transition-all duration-300 rounded-full ${
                idx === currentIndex ? 'w-6 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
};

export default ImageViewerModal;
