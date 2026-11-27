/** The site mark: an "RC" monogram drawn like an inked library stamp. Takes the surrounding text colour. */
export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" focusable="false">
      <circle cx="17" cy="17" r="15" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="17" r="11.5" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 2" />
      <text
        x="17"
        y="21.5"
        textAnchor="middle"
        fontFamily="Lora, Georgia, serif"
        fontWeight="700"
        fontSize="12"
        fill="currentColor"
      >
        RC
      </text>
    </svg>
  );
}
