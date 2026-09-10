import PostCard from "./PostCard";
import LoadingState from "./LoadingState";

export default function PostList({ posts = [], isLoading = false, onPostUpdated, onPostDeleted }) {
  if (posts.length === 0) {
    return (
      <div className="post-list-empty">
        {isLoading ? <LoadingState label="Loading feed" /> : 'No posts available yet.'}
      </div>
    );
  }

  return (
    <div className="post-list">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onPostUpdated={onPostUpdated}
          onPostDeleted={onPostDeleted}
        />
      ))}
    </div>
  );
}
