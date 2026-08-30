import { useState } from "react";
import { FaPlus } from "react-icons/fa";
import "./StoriesBar.css";

const initialStories = [
  { id: 1, name: "You", isYou: true },
  { id: 2, name: "Aung" },
  { id: 3, name: "Luna" },
  { id: 4, name: "John" },
  { id: 5, name: "Sara" },
];

export default function StoriesBar() {
  const [stories, setStories] = useState(initialStories);

  const handleAddStory = () => {
    const storyText = window.prompt("Write your story...");

    if (!storyText || !storyText.trim()) return;

    const newStory = {
      id: Date.now(),
      name: "You",
      isYou: true,
      preview: storyText.trim(),
    };

    setStories((prev) => [newStory, ...prev]);
  };

  return (
    <div className="stories-bar">
      {stories.map((s) => (
        <div key={s.id} className="story">
          <div className="story-avatar-wrap">
            <div
              className="story-avatar"
              style={
                s.isYou
                  ? {
                      background: "var(--yellow)",
                      color: "var(--navy)",
                    }
                  : {}
              }
            >
              {s.name.charAt(0)}
            </div>

            {s.isYou && (
              <button
                className="story-add-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddStory();
                }}
                aria-label="Add story"
              >
                <FaPlus />
              </button>
            )}
          </div>

          <span>{s.name}</span>
        </div>
      ))}
    </div>
  );
}