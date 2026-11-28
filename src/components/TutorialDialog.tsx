import { ReactNode, useEffect, useRef, useState } from 'react';

/**
 * The first-time guide: a short card with a few steps that explains what this site is for and how
 * to get around. Everything people read is in STEPS below, so the wording is easy to change.
 */
interface Step {
  title: string;
  /** A small line drawing, on a 120 x 80 canvas */
  art: ReactNode;
  body: ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Read together, not alone',
    art: (
      <>
        <path d="M60 36C54 32 45 32 37 35V62C45 59 54 59 60 63C66 59 75 59 83 62V35C75 32 66 32 60 36Z" />
        <path d="M60 36V63" />
        <circle className="accent" cx="22" cy="22" r="6" />
        <path className="accent" d="M12 40C12 32 32 32 32 40" />
        <circle className="accent" cx="60" cy="10" r="6" />
        <path className="accent" d="M50 27C50 19 70 19 70 27" />
        <circle className="accent" cx="98" cy="22" r="6" />
        <path className="accent" d="M88 40C88 32 108 32 108 40" />
      </>
    ),
    body: (
      <>
        <p>
          This isn’t a place to track every book you own, the way Goodreads or StoryGraph do. It’s for
          reading along with your people, one challenge at a time.
        </p>
        <p>The books on your profile are the ones you read for a challenge.</p>
      </>
    ),
  },
  {
    title: 'Start with a group',
    art: (
      <>
        <circle cx="60" cy="26" r="9" />
        <path d="M44 56C44 40 76 40 76 56" />
        <circle className="accent" cx="26" cy="34" r="7" />
        <path className="accent" d="M13 58C13 46 39 46 39 58" />
        <circle className="accent" cx="94" cy="34" r="7" />
        <path className="accent" d="M81 58C81 46 107 46 107 58" />
        <path d="M30 70H90" />
      </>
    ),
    body: (
      <>
        <p>
          Your groups are on <strong>Home</strong>. Join one with an invite link from a friend or family
          member, or create your own and invite people to it.
        </p>
        <p>Owners and admins make the invite links, which work for 14 days.</p>
      </>
    ),
  },
  {
    title: 'Challenges are made of prompts',
    art: (
      <>
        <rect x="22" y="12" width="14" height="14" rx="3" />
        <path className="accent" d="M25 19L28 22L33 15" />
        <path d="M46 19H98" />
        <rect x="22" y="33" width="14" height="14" rx="3" />
        <path className="accent" d="M25 40L28 43L33 36" />
        <path d="M46 40H88" />
        <rect x="22" y="54" width="14" height="14" rx="3" />
        <path d="M46 61H94" />
      </>
    ),
    body: (
      <>
        <p>
          A group’s challenge is a list of prompts, like “a book set in another country”. Open a challenge,
          then for each prompt you can:
        </p>
        <ul>
          <li><strong>Consider</strong> books you might read, and say why they fit</li>
          <li><strong>Start reading</strong> one, and update how far you are</li>
          <li>Log it as <strong>read</strong> with a rating and notes</li>
        </ul>
        <p>Books are added from inside a prompt, not from your profile.</p>
      </>
    ),
  },
  {
    title: 'Talk about what you’re reading',
    art: (
      <>
        <path d="M18 8H70Q75 8 75 13V30Q75 35 70 35H38L28 44V35H18Q13 35 13 30V13Q13 8 18 8Z" />
        <path d="M24 17H64M24 26H50" />
        <path className="accent" d="M52 42H102Q107 42 107 47V62Q107 67 102 67H96V76L86 67H52Q47 67 47 62V47Q47 42 52 42Z" />
      </>
    ),
    body: (
      <>
        <p>
          Every prompt and every book has its own discussion, so you can compare notes. You can blur a
          message that gives away the ending.
        </p>
        <p>
          <strong>Find books</strong> in the top bar searches by tag, title or author, and shows who in
          your groups has read, is reading or has talked about each one.
        </p>
      </>
    ),
  },
  {
    title: 'Your profile',
    art: (
      <>
        <circle cx="38" cy="30" r="14" />
        <circle cx="38" cy="26" r="5" />
        <path d="M28 38C30 33 46 33 48 38" />
        <path d="M18 70C18 54 58 54 58 70" />
        <path className="accent" d="M76 20H100V62H80Q76 62 76 58V20Z" />
        <path className="accent" d="M82 30H94M82 38H94M82 46H90" />
      </>
    ),
    body: (
      <>
        <p>
          Your profile is a record of what you’ve read for challenges, plus your name, your picture and a
          book you love right now (choose <strong>Edit profile</strong>).
        </p>
        <p>
          Books don’t get added there. They show up as you log them in a challenge. You can open this guide
          again any time from <strong>How it works</strong> in the top bar.
        </p>
      </>
    ),
  },
];

export default function TutorialDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  // Focus the card so the keyboard works straight away, and close on Escape
  useEffect(() => {
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog tutorial"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        tabIndex={-1}
        ref={card}
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="tutorial-art" viewBox="0 0 120 80" aria-hidden="true">
          {current.art}
        </svg>
        <div className="tutorial-text" aria-live="polite">
          <p className="eyebrow">Step {step + 1} of {STEPS.length}</p>
          <h2 id="tutorial-title">{current.title}</h2>
          {current.body}
        </div>
        <div className="tutorial-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <div className="row dialog-actions tutorial-actions">
          {!last && <button className="link" onClick={onClose}>Skip</button>}
          <span className="grow" />
          {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
          {last ? (
            <button className="primary" onClick={onClose}>Done</button>
          ) : (
            <button className="primary" onClick={() => setStep(step + 1)}>Next</button>
          )}
        </div>
      </div>
    </div>
  );
}
