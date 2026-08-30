import PostCard from "./PostCard";

export default function PostList({ posts = [], isLoading = false, onPostUpdated }) {
  if (posts.length === 0) {
    return (
      <div className="post-list-empty">
        {isLoading ? 'Loading feed…' : 'No posts available yet.'}
      </div>
    );
  }

  return (
    <div className="post-list">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={{ ...post, verified: true }}
          onPostUpdated={onPostUpdated}
        />
      ))}
    </div>
  );
}
