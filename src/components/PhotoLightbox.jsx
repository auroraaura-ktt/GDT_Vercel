import { useEffect } from "react";

function stopPropagation(event) {
  if (event?.stopPropagation) event.stopPropagation();
}

/**
 * Lightbox / photo viewer for opening a larger preview of a post's photos.
 * Supports next/previous navigation, a close button, keyboard navigation, and
 * responsive sizing without cropping or distorting the image itself.
 */
export default function PhotoLightbox({ photos = [], currentIndex = -1, onClose, onNavigate }) {
  const count = Array.isArray(photos) ? photos.length : 0;
  // The viewer must only open when a valid photo index was explicitly chosen.
  // A null/undefined currentIndex means "closed"; loose comparisons would
  // otherwise coerce null to 0 and auto-open the lightbox on Feed load.
  const hasPhotos =
    count > 0 &&
    typeof currentIndex === "number" &&
    Number.isInteger(currentIndex) &&
    currentIndex >= 0 &&
    currentIndex < count;

  useEffect(() => {
    if (!hasPhotos) return undefined;

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      } else if (event.key === "ArrowLeft") {
        onNavigate?.((currentIndex - 1 + count) % count);
      } else if (event.key === "ArrowRight") {
        onNavigate?.((currentIndex + 1) % count);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [hasPhotos, count, currentIndex, onClose, onNavigate]);

  if (!hasPhotos) return null;

  const src = photos[currentIndex];
  const canPrev = count > 1;
  const canNext = count > 1;

  return (
    <div
      className="photo-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
    >
      <button
        type="button"
        className="photo-lightbox-close"
        aria-label="Close photo viewer"
        onClick={onClose}
      >
        &#10005;
      </button>

      {canPrev && (
        <button
          type="button"
          className="photo-lightbox-nav photo-lightbox-prev"
          aria-label="Previous photo"
          onClick={(event) => {
            stopPropagation(event);
            onNavigate?.((currentIndex - 1 + count) % count);
          }}
        >
          &#8249;
        </button>
      )}

      <figure className="photo-lightbox-stage" onClick={stopPropagation}>
        <img className="photo-lightbox-img" src={src} alt={`Photo ${currentIndex + 1} of ${count}`} />
      </figure>

      {canNext && (
        <button
          type="button"
          className="photo-lightbox-nav photo-lightbox-next"
          aria-label="Next photo"
          onClick={(event) => {
            stopPropagation(event);
            onNavigate?.((currentIndex + 1) % count);
          }}
        >
          &#8250;
        </button>
      )}

      {count > 1 && (
        <span className="photo-lightbox-counter">
          {currentIndex + 1} / {count}
        </span>
      )}
    </div>
  );
}