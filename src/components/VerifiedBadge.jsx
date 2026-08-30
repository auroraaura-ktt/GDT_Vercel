export default function VerifiedBadge({ size = "small" }) {
  const sizes = {
    small: {
      width: 18,
      height: 18,
      stroke: 1.8,
    },
    medium: {
      width: 22,
      height: 22,
      stroke: 2,
    },
    large: {
      width: 26,
      height: 26,
      stroke: 2.3,
    },
  };

  const s = sizes[size] || sizes.small;

  return (
    <div
      title="Verified Account"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: "6px",
        flexShrink: 0,
      }}
    >
      <svg
        width={s.width}
        height={s.height}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Decagram Badge */}
        <polygon
          points="
          12,1
          14.3,3.8
          18,2.8
          19.2,6.4
          22.5,8.5
          20.8,12
          22.5,15.5
          19.2,17.6
          18,21.2
          14.3,20.2
          12,23
          9.7,20.2
          6,21.2
          4.8,17.6
          1.5,15.5
          3.2,12
          1.5,8.5
          4.8,6.4
          6,2.8
          9.7,3.8
          "
          fill="#0B1E4F"
          stroke="#F5B62D"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Check Mark */}
        <path
          d="M8.5 12.2L10.8 14.5L15.8 9.5"
          stroke="#F5B62D"
          strokeWidth={s.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}