import { Link, useParams } from "react-router-dom";
import { useData } from "../hooks/data";
import { useAuth } from "../hooks/auth";
import { Heading, State } from "../components/UI";
export default function Districts(){
 const {districtId}=useParams();const {user}=useAuth();
 const districts=useData("/public/districts");
 const selected=districts.data?.find((d:{id:string})=>d.id===districtId);
 const members=useData(user && districtId ? `/members?district_id=${districtId}&limit=100` : null);
 const services=useData(user && districtId ? `/services?district_id=${districtId}&limit=100` : null);
 const restricted=!!user && user.role!=="ADMIN" && user.district_id!==districtId;
 return <div className="page-container">
 <Heading title={selected?.name||"Our Seven Districts"} sub="The Church of Pentecost Canada – Peel Halton Area" />
 {!districtId ? <State loading={districts.loading} error={districts.error}>
  <div className="grid two">{districts.data?.map((d:{id:string;name:string})=><Link className="card district-card" key={d.id} to={`/districts/${d.id}`}><h2>{d.name}</h2><p>Explore the district <span aria-hidden>→</span></p></Link>)}</div>
 </State> : !selected ? <p className="notice">This district was not found.</p> : !user ? <div className="card"><p>Sign in using your assigned district to view private records.</p><Link className="button" to="/login">Member login</Link></div>
 : restricted ? <p className="notice">You may view information for your assigned district only.</p>
 : user.role==="MEMBER" ? <div className="card"><h2>{selected.name}</h2><p>Your membership and attendance records are available in your private profile.</p><Link className="button" to="/profile">My profile</Link></div>
 : <><div className="card"><h2>District overview</h2><p>Showing records for {selected.name} only.</p><p>Members: {members.data?.total??"…"} · Services: {services.data?.total??"…"}</p><Link to="/members">Manage members</Link></div>
 <State loading={members.loading||services.loading} error={members.error||services.error}>
 <div className="grid two"><section className="card"><h2>Members</h2>{members.data?.items?.slice(0,12).map((m:any)=><p key={m.id}>{m.first_name} {m.last_name}</p>)}</section><section className="card"><h2>Services</h2>{services.data?.items?.slice(0,12).map((s:any)=><p key={s.id}>{s.name} · {String(s.date).slice(0,10)}</p>)}</section></div>
 </State></> }
 </div>;
}
