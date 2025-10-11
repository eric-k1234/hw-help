import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { deleteDoc, getDocs } from "firebase/firestore";

import {
  initializeApp, getApps
} from "firebase/app";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged,
  signInWithPopup, signOut
} from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, onSnapshot, addDoc, setDoc,
  updateDoc, query, where, orderBy, limit, serverTimestamp, increment
} from "firebase/firestore";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "firebase/storage";
function SignInButton(){
  const login = async () => {
    await signInWithPopup(getAuth(), new GoogleAuthProvider());
  };
  return <Button className="green" onClick={login}>Sign in</Button>;
}

function UserMenuCompact(){
  const { user } = useAuth();
  const logout = async () => { await signOut(getAuth()); };
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="avatar">{(user?.displayName || "U")[0]}</div>
      <div className="small muted" style={{ maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {user?.displayName || user?.email}
      </div>
      <Button className="ghost" onClick={logout}>Sign out</Button>
    </div>
  );
}

/** 🔧 Firebase config — replace with your project settings (safe to expose) */
const firebaseConfig = {
  apiKey: "AIzaSyAx2Qdx_Vm7CebcvljltJ4uVKUCIaFMMqo",
  authDomain: "homework-group-helper.firebaseapp.com",
  projectId: "homework-group-helper",
  storageBucket: "homework-group-helper.firebasestorage.app",
  messagingSenderId: "1082497052150",
  appId: "1:1082497052150:web:adba36fd6bd5f20189abd7",
  measurementId: "G-CGR3CXQ6DG"
};

if (!getApps().length) initializeApp(firebaseConfig);

const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

/** Helpers */
function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u); setLoading(false);
      if (!u) return;
      const uref = doc(db, "users", u.uid);
      const snap = await getDoc(uref);
      if (!snap.exists()) {
        await setDoc(uref, {
          uid: u.uid,
          displayName: u.displayName,
          photoURL: u.photoURL,
          email: u.email,
          points: 0,
          createdAt: serverTimestamp(),
        });
      }
    });
  }, []);
  return { user, loading };
}

function useColl(path, constraints = []) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setItems(arr);
    });
    return () => unsub();
  }, [path, JSON.stringify(constraints)]);
  return items;
}

const Rank = (pts) => {
  if (pts >= 1000) return { name: "Legend", className: "pill" };
  if (pts >= 500) return { name: "Gold Helper", className: "pill" };
  if (pts >= 250) return { name: "Silver Helper", className: "pill" };
  return { name: "Helper", className: "pill" };
};



async function deleteQuestionDeep(qid) {
  // delete all posts under this question, then the question
  const postsSnap = await getDocs(query(collection(db, "posts"), where("questionId","==", qid)));
  await Promise.all(postsSnap.docs.map(d => deleteDoc(doc(db, "posts", d.id))));
  await deleteDoc(doc(db, "questions", qid));
}

function useIsModerator() {
  const { user } = useAuth();
  const [isMod, setIsMod] = React.useState(false);
  React.useEffect(() => {
    if (!user) { setIsMod(false); return; }
    const uref = doc(db, "moderators", user.uid);
    return onSnapshot(uref, (snap) => setIsMod(snap.exists()), () => setIsMod(false));
  }, [user?.uid]);
  return isMod;
}

async function deleteClassIfEmpty(cid) {
  const qsSnap = await getDocs(query(collection(db, "questions"), where("classId","==", cid)));
  if (!qsSnap.empty) {
    alert("Class has questions. Delete/move them first.");
    return false;
  }
  await deleteDoc(doc(db, "classes", cid));
  return true;
}

/** UI atoms (no external UI lib) */
const Button = ({ className="", style={}, ...props }) => (
  <button className={"btn " + className} style={style} {...props} />
);
const Card = ({ className="", ...props }) => (
  <div className={"card " + className} {...props} />
);

/** Auth controls */
function SignIn() {
  const handle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      alert("Signed in");
    } catch (e) {
      alert(e?.message || "Sign-in failed");
    }
  };
  return <Button className="gold" onClick={handle}>Sign in with Google</Button>;
}

function UserMenu({ user }) {
  const [points, setPoints] = useState(0);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (d) => {
      setPoints(d.data()?.points || 0);
    });
  }, [user?.uid]);
  const r = Rank(points);
  return (
    <div className="row" style={{gap:8}}>
      <div className="avatar">{user?.displayName?.[0] || "U"}</div>
      <div>
        <div className="small" style={{fontWeight:700}}>{user?.displayName}</div>
        <div className="small muted">{user?.email}</div>
      </div>
      <span className="pill right">{r.name}</span>
      <Button className="ghost" onClick={() => signOut(auth)}>Sign out</Button>
    </div>
  );
}

/** Sidebar: classes */
function ClassSidebar({ activeClassId, onSelect }) {
  const classes = useColl("classes", [orderBy("name", "asc")]);
  const [name, setName] = useState("");
  const { user } = useAuth();

  const addClass = async () => {
    if (!user) return alert("Sign in to add a class");
    const n = name.trim();
    if (!n) return;
    await addDoc(collection(db, "classes"), { name: n, createdAt: serverTimestamp() });
    setName("");
  };

  return (
    <Card className="pad" style={{height:"fit-content"}}>
      <div className="row-justify">
        <div style={{fontWeight:800, color:"var(--green-700)"}}>Classes</div>
      </div>
      <div className="list" style={{marginTop:12}}>
        <Button className={activeClassId===null? "ghost": ""} onClick={()=>onSelect(null)}>All Questions</Button>
        {classes.map((c) => (
          <Button key={c.id} className={activeClassId===c.id? "ghost": ""} onClick={()=>onSelect(c.id)}>{c.name}</Button>
        ))}
      </div>
      <div style={{marginTop:12}}>
        <div className="small muted" style={{marginBottom:6}}>Add class</div>
        <div className="row">
          <input className="input" placeholder="e.g. Algebra II" value={name} onChange={e=>setName(e.target.value)}/>
          <Button className="green" onClick={addClass}>Add</Button>
        </div>
      </div>
    </Card>
  );
}

/** New Question */
function NewQuestion({ currentClassId }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="Homework Helper" onClick={()=>setOpen(true)}>New Question</Button>
      {open && <NewQuestionDialog onClose={()=>setOpen(false)} currentClassId={currentClassId}/>}
    </>
  );
}
function NewQuestionDialog({ onClose, currentClassId }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classId, setClassId] = useState(currentClassId);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const classes = useColl("classes", [orderBy("name", "asc")]);
  const { user } = useAuth();

  useEffect(()=>setClassId(currentClassId), [currentClassId]);

  const create = async () => {
    if (!user) return alert("Sign in to post");
    if (!title.trim() || !classId) return alert("Title and class required");
    try {
      setBusy(true);
      let attachmentURL = null;
      if (file) {
        const sref = storageRef(getStorage(), `attachments/${user.uid}/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(sref, file);
        attachmentURL = await getDownloadURL(snap.ref);
      }
      await addDoc(collection(db, "questions"), {
        title: title.trim(),
        body: body.trim(),
        classId,
        createdAt: serverTimestamp(),
        authorId: user.uid,
        createdAtMs: Date.now(),
        authorName: user.displayName,
        authorPhoto: user.photoURL,
        attachmentURL,
        postsCount: 0,
      });
      onClose();
      alert("Question posted");
    } finally { setBusy(false); }
  };

  return (
    <div className="card pad" style={{position:"fixed", inset:"10% 10% auto 10%", background:"white", zIndex:50}}>
      <div className="row-justify">
        <div style={{fontWeight:800}}>Ask a homework question</div>
        <Button className="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="list" style={{marginTop:12}}>
        <input className="input" placeholder="Short title" value={title} onChange={e=>setTitle(e.target.value)} />
        <textarea className="input" rows="5" placeholder="Describe the problem." value={body} onChange={e=>setBody(e.target.value)} />
        <div className="row">
          <select className="input" value={classId || ""} onChange={e=>setClassId(e.target.value || null)}>
            <option value="">Select class</option>
            {classes.map((c)=> <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="file" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="row" style={{justifyContent:"flex-end"}}>
          <Button className="green" disabled={busy} onClick={create}>{busy? "Posting..." : "Post"}</Button>
        </div>
      </div>
    </div>
  );
}

/** Feed */
function QuestionsFeed({ activeClassId, onOpen }) {
  const { user } = useAuth();
  // Use moderator hook if you added it; otherwise default to false
  const isModerator = typeof useIsModerator === "function" ? useIsModerator() : false;

  const [search, setSearch] = useState("");

  // Prefer numeric timestamp for reliable ordering; falls back below if some docs lack it
  const questions = useColl("questions", [orderBy("createdAtMs", "desc")]);
  const classes = useColl("classes", []);
  const classNameById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c.name])),
    [classes]
  );

  // Delete a question and all its replies
  const deleteQuestionDeep = async (qid) => {
    try {
      // delete posts first
      const postsSnap = await getDocs(
        query(collection(db, "posts"), where("questionId", "==", qid))
      );
      await Promise.all(
        postsSnap.docs.map((d) => deleteDoc(doc(db, "posts", d.id)))
      );
      // then delete the question
      await deleteDoc(doc(db, "questions", qid));
      // (optional) no need to manually decrement postsCount since question is gone
    } catch (e) {
      console.error("Delete question failed:", e);
      alert("Failed to delete: " + (e?.message || e));
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = questions
      .filter((q) => !activeClassId || q.classId === activeClassId)
      .filter(
        (q) =>
          !term ||
          q.title?.toLowerCase().includes(term) ||
          q.body?.toLowerCase().includes(term)
      );

    // Ensure consistent ordering even if some docs are missing createdAtMs
    return base.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [questions, activeClassId, search]);

  // Helper to show a readable timestamp
  const prettyTime = (q) => {
    if (q?.createdAt?.toDate) {
      try {
        return new Date(q.createdAt.toDate()).toLocaleString();
      } catch {}
    }
    if (q?.createdAtMs) return new Date(q.createdAtMs).toLocaleString();
    return "";
  };

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <input
          className="input"
          placeholder="Search questions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <AnimatePresence mode="popLayout">
          {filtered.map((q) => (
            <motion.div
              key={q.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Card className="pad">
                <div className="row-justify">
                  <div className="row" style={{ gap: 8 }}>
                    <div className="avatar">{q.authorName?.[0] || "?"}</div>
                    <div>
                      <div className="small" style={{ fontWeight: 700 }}>
                        {q.authorName || "Anon"}
                      </div>
                      <div className="small muted">{prettyTime(q)}</div>
                    </div>
                  </div>
                  <span className="pill">
                    {classNameById[q.classId] || "Class"}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontWeight: 800,
                    color: "var(--green-700)",
                  }}
                >
                  {q.title}
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {q.body}
                </div>
                {q.attachmentURL && (
                  <img className="img" src={q.attachmentURL} alt="attachment" />
                )}

                <div
                  className="row"
                  style={{ justifyContent: "space-between", marginTop: 10 }}
                >
                  <Button className="ghost" onClick={() => onOpen(q)}>
                    {q.postsCount || 0} replies
                  </Button>

                  <div className="row" style={{ gap: 8 }}>
                    {user && (isModerator || user.uid === q.authorId) && (
                      <Button
                        className="ghost"
                        onClick={async () => {
                          if (
                            confirm(
                              "Delete this question and ALL its replies?"
                            )
                          ) {
                            await deleteQuestionDeep(q.id);
                          }
                        }}
                        title="Delete question"
                      >
                        🗑️
                      </Button>
                    )}
                    <Button className="green" onClick={() => onOpen(q)}>
                      Open
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Question detail */
function QuestionDetail({ q, onClose }) {
  const { user } = useAuth();
  const isModerator = typeof useIsModerator === "function" ? useIsModerator() : false;

  const [posts, setPosts] = React.useState([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // ✅ Load replies without orderBy; sort on client by createdAtMs
  React.useEffect(() => {
    if (!q?.id) return;
    const unsub = onSnapshot(
      query(collection(db, "posts"), where("questionId", "==", q.id)),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        arr.sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
        setPosts(arr);
      },
      (err) => console.error("posts onSnapshot error", err)
    );
    return () => unsub();
  }, [q?.id]);

  const addPost = async () => {
    if (!user) return alert("Sign in to reply");
    const t = text.trim();
    if (!t) return;

    try {
      setBusy(true);
      await addDoc(collection(db, "posts"), {
        questionId: q.id,
        text: t,
        createdAt: serverTimestamp(),
        createdAtMs: Date.now(), // ✅ numeric fallback for ordering
        authorId: user.uid,
        authorName: user.displayName,
        authorPhoto: user.photoURL,
        helpful: 0,
      });
      await updateDoc(doc(db, "questions", q.id), {
        postsCount: (q.postsCount || 0) + 1,
      });
      setText("");
    } catch (e) {
      console.error("Add reply failed:", e);
      alert("Failed to reply: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const markHelpful = async (post) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", post.authorId), { points: increment(10) });
      await updateDoc(doc(db, "posts", post.id), { helpful: increment(1) });
      alert("Marked helpful (+10 points)");
    } catch (e) {
      console.error("Mark helpful failed:", e);
      alert("Failed to mark helpful: " + (e?.message || e));
    }
  };

  const deleteReply = async (postId) => {
    if (!user) return;
    if (!confirm("Delete this reply?")) return;
    try {
      await deleteDoc(doc(db, "posts", postId));
    } catch (e) {
      console.error("Delete reply failed:", e);
      alert("Failed to delete: " + (e?.message || e));
    }
  };

  return (
    <div
      className="card pad"
      style={{
        position: "fixed",
        inset: "6% 6% auto 6%",
        background: "white",
        zIndex: 60,
        maxHeight: "88vh",
        overflow: "auto",
      }}
    >
      <div className="row-justify">
        <div style={{ fontWeight: 800, color: "var(--green-700)" }}>{q?.title}</div>
        <Button className="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <div className="avatar">{q?.authorName?.[0] || "?"}</div>
        <div className="small" style={{ fontWeight: 700 }}>
          {q?.authorName}
        </div>
        <span className="pill right">Question</span>
      </div>

      <div className="muted" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
        {q?.body}
      </div>
      {q?.attachmentURL && <img className="img" src={q.attachmentURL} alt="attachment" />}

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <div className="small muted">Replies</div>
      </div>

      <div className="list" style={{ marginTop: 8 }}>
        {posts.map((p) => (
          <div key={p.id} className="card pad">
            <div className="row" style={{ gap: 8 }}>
              <div className="avatar">{p.authorName?.[0] || "?"}</div>
              <div className="small" style={{ fontWeight: 700 }}>
                {p.authorName}
              </div>

              {/* 🗑️ show only to owner or moderator */}
              {user && (isModerator || user.uid === p.authorId) && (
                <div className="right">
                  <Button className="ghost" onClick={() => deleteReply(p.id)} title="Delete reply">
                    🗑️
                  </Button>
                </div>
              )}

              <div className="right helpful" onClick={() => markHelpful(p)}>
                Helpful: {p.helpful || 0}
              </div>
            </div>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{p.text}</div>
          </div>
        ))}
        {posts.length === 0 && <div className="muted">Be the first to reply.</div>}
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        <textarea
          className="input"
          rows="3"
          placeholder="Write a helpful reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button className="green" disabled={busy} onClick={addPost}>
            {busy ? "Posting..." : "Reply"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Leaderboard */
function Leaderboard(){
  const top = useColl("users", [orderBy("points","desc"), limit(10)]);
  return (
    <Card className="pad">
      <div className="row" style={{gap:8, marginBottom:8}}>
        <div className="pill" style={{background:"#fff7ed", borderColor:"#fed7aa", color:"#7c2d12"}}>Top Helpers</div>
      </div>
      <div className="list">
        {top.map((u, i)=>{
          const r = Rank(u.points||0);
          return (
            <div key={u.uid||i} className="row" style={{gap:10}}>
              <div className="pill" style={{background:"#fde68a", borderColor:"#f59e0b", color:"#7c2d12"}}>{i+1}</div>
              <div className="avatar">{u.displayName?.[0]||"?"}</div>
              <div style={{fontWeight:700}}>{u.displayName || "Student"}</div>
              <span className="pill right">{r.name}</span>
              <div style={{fontWeight:800, color:"var(--green-700)"}}>{u.points||0}</div>
            </div>
          );
        })}
        {top.length===0 && <div className="muted">No helpers yet. Start answering to earn points!</div>}
      </div>
    </Card>
  );
}

function Rewards(){
  return (
    <Card className="pad">
      <div className="row" style={{gap:8}}>
        <div className="pill">Monthly Rewards</div>
      </div>
      <div className="muted" style={{marginTop:6}}>
        #1 Helper earns a shout‑out and a prize every month. Keep it helpful and respectful.
      </div>
    </Card>
  );
}
function TipsCard() {
  return (
    <Card className="pad">
      <div className="row-justify">
        <div style={{ fontWeight: 800 }}>Study Tips</div>
        <span className="pill">Gold</span>
      </div>
      <ul className="muted" style={{ marginTop: 8, paddingLeft: 16 }}>
        <li>Ask one clear question per post.</li>
        <li>Show your work; say where you’re stuck.</li>
        <li>Mark helpful replies to reward helpers.</li>
      </ul>
    </Card>
  );
}

function HeaderBar() {
  const { user } = useAuth();

  return (
    <div
      className="app-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(14px)",
        background: "linear-gradient(180deg, rgba(255,255,255,.75), rgba(255,255,255,.55))",
        borderBottom: "1px solid rgba(16,185,129,.18)",
        padding: "12px 16px",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: "0 0 18px 18px",
        boxShadow: "0 10px 28px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.55)",
      }}
    >
      <div style={{ fontWeight: 800, letterSpacing: ".2px" }}>
        <span
          style={{
            background: "linear-gradient(90deg, var(--au-400), var(--em-600))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Homework Helper
        </span>
      </div>
      {user && (
  <Button
    className="ghost"
    onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
  >
    ⚙️ Settings
  </Button>
)}

      <div>{user ? <UserMenuCompact /> : <SignInButton />}</div>
      
    </div>
  );
}

/** App Shell */
function SettingsDialog({ onClose }) {
  const { user } = useAuth();
  const [username, setUsername] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (user?.displayName) setUsername(user.displayName);
  }, [user]);

  const save = async () => {
    if (!user) return alert("You must be signed in");
    if (!username.trim()) return alert("Username cannot be empty");
    setBusy(true);
    setSaved(false);
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          username: username.trim(),
          displayName: username.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSaved(true);
    } catch (e) {
      console.error(e);
      alert("Error saving username: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="card pad"
      style={{
        position: "fixed",
        inset: "6% 6% auto 6%",
        background: "linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.88))",
        zIndex: 80,
        maxHeight: "88vh",
        overflow: "auto",
        border: "1px solid rgba(16,185,129,.28)",
        boxShadow: "0 30px 90px rgba(15,23,42,.22)",
      }}
    >
      <div className="row-justify">
        <div style={{ fontWeight: 800 }}>Settings</div>
        <Button className="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div style={{ marginTop: 16 }}>
        <label className="small muted">Username</label>
        <input
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
        />

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <Button className="green" disabled={busy} onClick={save}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>

        {saved && <div className="small" style={{ color: "var(--em-600)" }}>✅ Saved!</div>}
      </div>
    </div>
  );
}

/** App Shell */
/** App Shell */
/** App Shell */

function Safe({ children }) {
  const [err, setErr] = React.useState(null);
  React.useEffect(() => {
    const onRejection = (e) => setErr(e.reason || e);
    const onError = (e) => setErr(e.error || e.message || "Error");
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  if (err) {
    return (
      <div style={{ padding: 16, color: "crimson", fontFamily: "monospace" }}>
        <div>⚠️ Runtime error</div>
        <pre style={{ whiteSpace: "pre-wrap" }}>{String(err)}</pre>
      </div>
    );
  }
  return children;
}

 export default function App() {
  // ⬇️ STATE FIRST
  const [activeClassId, setActiveClassId] = React.useState(null);
  const [activeQuestion, setActiveQuestion] = React.useState(null);
  const [showNewQuestion, setShowNewQuestion] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const { user } = useAuth();

  // ⬇️ EFFECTS AFTER STATE
  React.useEffect(() => {
    const open = () => setShowNewQuestion(true);
    window.addEventListener("open-new-question", open);
    return () => window.removeEventListener("open-new-question", open);
  }, []);

  React.useEffect(() => {
    const open = () => setShowSettings(true);
    window.addEventListener("open-settings", open);
    return () => window.removeEventListener("open-settings", open);
  }, []);
  return (
    <Safe>
    <div className="shell">
      <HeaderBar />

      <div className="container">
        <div className="layout">
          <main className="main">
            <div className="row-justify" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 900, letterSpacing: ".3px" }}>Questions</div>
              <div className="row" style={{ gap: 8 }}>
                <Button
                  className="green"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("open-new-question"))
                  }
                >
                  + Ask Question
                </Button>
              </div>
            </div>

            <QuestionsFeed
              activeClassId={activeClassId}
              onOpen={(q) => setActiveQuestion(q)}
            />
          </main>

          <aside className="side">
            <ClassSidebar
              activeClassId={activeClassId}
              onSelect={setActiveClassId}
            />
            <TipsCard />
            <Leaderboard />
          </aside>
        </div>
      </div>

      {activeQuestion && (
        <QuestionDetail q={activeQuestion} onClose={() => setActiveQuestion(null)} />
      )}

      {showNewQuestion && (
        <NewQuestionDialog
          currentClassId={activeClassId}
          onClose={() => setShowNewQuestion(false)}
        />
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
    </Safe>  
  );
}


