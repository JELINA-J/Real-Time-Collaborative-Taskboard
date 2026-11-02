import { Link, useParams } from "react-router-dom";
import Topbar from "../components/Topbar";

export default function Board() {
  const { id } = useParams();
  return (
    <>
      <Topbar />
      <div className="page">
        <Link to="/">← Back</Link>
        <h1>Board {id}</h1>
        <p className="muted">The task board comes in Step 8.</p>
      </div>
    </>
  );
}