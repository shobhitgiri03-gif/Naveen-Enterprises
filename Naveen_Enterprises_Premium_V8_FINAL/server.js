const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const {DatabaseSync}=require("node:sqlite");
const ROOT=__dirname,PORT=process.env.PORT||3000;
const db=new DatabaseSync(path.join(ROOT,"data.sqlite"));
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,full_name TEXT,role TEXT DEFAULT 'admin',active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL,slug TEXT UNIQUE NOT NULL,description TEXT,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,category_id INTEGER,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,description TEXT,image_url TEXT,price REAL,featured INTEGER DEFAULT 0,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS gallery(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT,image_url TEXT NOT NULL,alt_text TEXT,sort_order INTEGER DEFAULT 0,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS enquiries(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,email TEXT,product_id INTEGER,message TEXT,status TEXT DEFAULT 'New',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY,v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity_log(id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id INTEGER,action TEXT,details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS files(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,url TEXT NOT NULL,type TEXT DEFAULT 'image',created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);

function slug(x){return String(x).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"item-"+Date.now()}
function hash(p){return crypto.createHash("sha256").update(String(p)).digest("hex")}
function settings(){return Object.fromEntries(db.prepare("SELECT k,v FROM settings").all().map(x=>[x.k,x.v]))}
function log(adminId,action,details=""){db.prepare("INSERT INTO activity_log(admin_id,action,details) VALUES(?,?,?)").run(adminId,action,details)}
function makeAdmin(){
  if(!db.prepare("SELECT COUNT(*) c FROM admins").get().c){
    db.prepare("INSERT INTO admins(username,password_hash,full_name,role) VALUES(?,?,?,?)")
      .run("admin",hash(process.env.ADMIN_PASS||"change-me-now"),"Naveen Enterprises Admin","admin");
  }
}
makeAdmin();
const defs={brand_name:"NAVEEN ENTERPRISES",tagline:"BAKE & PACK SOLUTION",hero_company_color:"#526d9c",hero_tagline_color:"#7890b7",phone:"",whatsapp:"",email:"",address:""};
for(const [k,v] of Object.entries(defs))db.prepare("INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)").run(k,v);
if(!db.prepare("SELECT COUNT(*) c FROM categories").get().c){for(const [n,s] of [["Bakery","bakery"],["Cake Supplies","cake-supplies"],["Packaging","packaging"],["Bags","bags"],["Party","party"]])db.prepare("INSERT INTO categories(name,slug) VALUES(?,?)").run(n,s)}
const sessions=new Map();
function body(req){return new Promise((res,rej)=>{let b="";req.on("data",c=>{b+=c;if(b.length>3e6)req.destroy()});req.on("end",()=>{try{res(b?JSON.parse(b):{})}catch(e){rej(e)}})})}
function send(res,c,data,type="application/json",headers={}){res.writeHead(c,{"Content-Type":type,"Cache-Control":"no-store",...headers});res.end(type.startsWith("application/json")?JSON.stringify(data):data)}
function tok(req){return (req.headers.cookie||"").match(/v8sid=([^;]+)/)?.[1]}
function current(req){let t=tok(req),s=sessions.get(t);if(!s||s.exp<Date.now()){if(t)sessions.delete(t);return null}return s}
function auth(req,res){let s=current(req);if(!s){send(res,401,{error:"Unauthorized"});return null}return s}
function adminProfile(id){return db.prepare("SELECT id,username,full_name,role,active,created_at,updated_at FROM admins WHERE id=?").get(id)}

async function api(req,res,u){
  if(req.method==="POST"&&u.pathname==="/api/login"){
    const b=await body(req),a=db.prepare("SELECT * FROM admins WHERE username=? AND active=1").get(b.username||"");
    if(a && a.password_hash===hash(b.password||"")){
      const t=crypto.randomBytes(32).toString("hex");sessions.set(t,{id:a.id,exp:Date.now()+86400000});
      log(a.id,"LOGIN","Admin login");
      return send(res,200,{ok:true,user:adminProfile(a.id)},"application/json",{"Set-Cookie":`v8sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`});
    }
    return send(res,401,{error:"Invalid username or password"});
  }
  if(req.method==="POST"&&u.pathname==="/api/logout"){let s=current(req);if(s)log(s.id,"LOGOUT","Admin logout");sessions.delete(tok(req));return send(res,200,{ok:true},"application/json",{"Set-Cookie":"v8sid=; Max-Age=0; Path=/"})}

  // Public/customer API
  if(u.pathname==="/api/products"&&req.method==="GET")return send(res,200,db.prepare("SELECT p.*,c.name category FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1 ORDER BY p.featured DESC,p.id DESC").all());
  if(u.pathname==="/api/categories"&&req.method==="GET")return send(res,200,db.prepare("SELECT * FROM categories WHERE active=1 ORDER BY name").all());
  if(u.pathname==="/api/gallery"&&req.method==="GET")return send(res,200,db.prepare("SELECT * FROM gallery WHERE active=1 ORDER BY sort_order,id DESC").all());
  if(u.pathname==="/api/settings"&&req.method==="GET")return send(res,200,settings());
  if(u.pathname==="/api/enquiries"&&req.method==="POST"){let b=await body(req);if(!b.name)return send(res,400,{error:"Name required"});db.prepare("INSERT INTO enquiries(name,phone,email,product_id,message) VALUES(?,?,?,?,?)").run(b.name,b.phone||"",b.email||"",b.product_id||null,b.message||"");return send(res,201,{ok:true})}

  if(!u.pathname.startsWith("/api/admin/"))return false;
  const s=auth(req,res);if(!s)return true;

  if(u.pathname==="/api/admin/me"&&req.method==="GET")return send(res,200,adminProfile(s.id));
  if(u.pathname==="/api/admin/summary"&&req.method==="GET")return send(res,200,{
    products:db.prepare("SELECT COUNT(*) c FROM products WHERE active=1").get().c,
    categories:db.prepare("SELECT COUNT(*) c FROM categories WHERE active=1").get().c,
    gallery:db.prepare("SELECT COUNT(*) c FROM gallery WHERE active=1").get().c,
    enquiries:db.prepare("SELECT COUNT(*) c FROM enquiries WHERE status!='Closed'").get().c,
    admins:db.prepare("SELECT COUNT(*) c FROM admins WHERE active=1").get().c,
    files:db.prepare("SELECT COUNT(*) c FROM files").get().c
  });

  // Profile/password
  if(u.pathname==="/api/admin/profile"&&req.method==="PUT"){let b=await body(req);db.prepare("UPDATE admins SET full_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(b.full_name||"",s.id);log(s.id,"PROFILE_UPDATE","Profile updated");return send(res,200,{ok:true})}
  if(u.pathname==="/api/admin/password"&&req.method==="PUT"){let b=await body(req),a=db.prepare("SELECT password_hash FROM admins WHERE id=?").get(s.id);
    if(!b.current_password||hash(b.current_password)!==a.password_hash)return send(res,400,{error:"Current password is incorrect"});
    if(!b.new_password||String(b.new_password).length<8)return send(res,400,{error:"New password must be at least 8 characters"});
    db.prepare("UPDATE admins SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(hash(b.new_password),s.id);log(s.id,"PASSWORD_CHANGE","Password changed");return send(res,200,{ok:true});
  }

  // Products
  if(u.pathname==="/api/admin/products"&&req.method==="GET")return send(res,200,db.prepare("SELECT p.*,c.name category FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.id DESC").all());
  if(u.pathname==="/api/admin/product"&&req.method==="POST"){let b=await body(req);db.prepare("INSERT INTO products(category_id,name,slug,description,image_url,price,featured) VALUES(?,?,?,?,?,?,?)").run(b.category_id||null,b.name,slug(b.name),b.description||"",b.image_url||"",b.price||null,b.featured?1:0);log(s.id,"PRODUCT_CREATE",b.name);return send(res,201,{ok:true})}
  if(u.pathname.startsWith("/api/admin/product/")&&req.method==="PUT"){let id=+u.pathname.split("/").pop(),b=await body(req);db.prepare("UPDATE products SET category_id=?,name=?,description=?,image_url=?,price=?,featured=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(b.category_id||null,b.name,b.description||"",b.image_url||"",b.price||null,b.featured?1:0,id);log(s.id,"PRODUCT_UPDATE",String(id));return send(res,200,{ok:true})}
  if(u.pathname.startsWith("/api/admin/product/")&&req.method==="DELETE"){let id=+u.pathname.split("/").pop();db.prepare("UPDATE products SET active=0 WHERE id=?").run(id);log(s.id,"PRODUCT_DELETE",String(id));return send(res,200,{ok:true})}

  // Categories
  if(u.pathname==="/api/admin/categories"&&req.method==="GET")return send(res,200,db.prepare("SELECT * FROM categories ORDER BY id DESC").all());
  if(u.pathname==="/api/admin/category"&&req.method==="POST"){let b=await body(req);db.prepare("INSERT INTO categories(name,slug,description) VALUES(?,?,?)").run(b.name,slug(b.name),b.description||"");log(s.id,"CATEGORY_CREATE",b.name);return send(res,201,{ok:true})}
  if(u.pathname.startsWith("/api/admin/category/")&&req.method==="PUT"){let id=+u.pathname.split("/").pop(),b=await body(req);db.prepare("UPDATE categories SET name=?,description=? WHERE id=?").run(b.name,b.description||"",id);log(s.id,"CATEGORY_UPDATE",String(id));return send(res,200,{ok:true})}
  if(u.pathname.startsWith("/api/admin/category/")&&req.method==="DELETE"){let id=+u.pathname.split("/").pop();db.prepare("UPDATE categories SET active=0 WHERE id=?").run(id);log(s.id,"CATEGORY_DELETE",String(id));return send(res,200,{ok:true})}

  // Gallery
  if(u.pathname==="/api/admin/gallery"&&req.method==="GET")return send(res,200,db.prepare("SELECT * FROM gallery ORDER BY sort_order,id DESC").all());
  if(u.pathname==="/api/admin/gallery"&&req.method==="POST"){let b=await body(req);db.prepare("INSERT INTO gallery(title,image_url,alt_text,sort_order) VALUES(?,?,?,?)").run(b.title||"",b.image_url,b.alt_text||"",b.sort_order||0);log(s.id,"GALLERY_CREATE",b.title||"");return send(res,201,{ok:true})}
  if(u.pathname.startsWith("/api/admin/gallery/")&&req.method==="PUT"){let id=+u.pathname.split("/").pop(),b=await body(req);db.prepare("UPDATE gallery SET title=?,image_url=?,alt_text=?,sort_order=?,active=? WHERE id=?").run(b.title||"",b.image_url,b.alt_text||"",b.sort_order||0,b.active===false?0:1,id);log(s.id,"GALLERY_UPDATE",String(id));return send(res,200,{ok:true})}
  if(u.pathname.startsWith("/api/admin/gallery/")&&req.method==="DELETE"){let id=+u.pathname.split("/").pop();db.prepare("UPDATE gallery SET active=0 WHERE id=?").run(id);log(s.id,"GALLERY_DELETE",String(id));return send(res,200,{ok:true})}

  // Enquiries
  if(u.pathname==="/api/admin/enquiries"&&req.method==="GET")return send(res,200,db.prepare("SELECT e.*,p.name product FROM enquiries e LEFT JOIN products p ON p.id=e.product_id ORDER BY e.id DESC").all());
  if(u.pathname.startsWith("/api/admin/enquiry/")&&req.method==="PUT"){let id=+u.pathname.split("/").pop(),b=await body(req);db.prepare("UPDATE enquiries SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(b.status,id);log(s.id,"ENQUIRY_STATUS",id+":"+b.status);return send(res,200,{ok:true})}

  // Settings
  if(u.pathname==="/api/admin/settings"&&req.method==="PUT"){let b=await body(req);for(let [k,v] of Object.entries(b))db.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)").run(k,String(v));log(s.id,"SETTINGS_UPDATE","Website settings");return send(res,200,{ok:true})}

  // Admin users
  if(u.pathname==="/api/admin/users"&&req.method==="GET")return send(res,200,db.prepare("SELECT id,username,full_name,role,active,created_at FROM admins ORDER BY id DESC").all());
  if(u.pathname==="/api/admin/user"&&req.method==="POST"){if(s.id!==1&&db.prepare("SELECT role FROM admins WHERE id=?").get(s.id)?.role!=="admin")return send(res,403,{error:"Admin only"});let b=await body(req);if(!b.username||!b.password||b.password.length<8)return send(res,400,{error:"Username and 8+ character password required"});db.prepare("INSERT INTO admins(username,password_hash,full_name,role) VALUES(?,?,?,?)").run(b.username,hash(b.password),b.full_name||"",b.role==="staff"?"staff":"admin");log(s.id,"USER_CREATE",b.username);return send(res,201,{ok:true})}
  if(u.pathname.startsWith("/api/admin/user/")&&req.method==="PUT"){let id=+u.pathname.split("/").pop(),b=await body(req);db.prepare("UPDATE admins SET full_name=?,role=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(b.full_name||"",b.role==="staff"?"staff":"admin",b.active===false?0:1,id);log(s.id,"USER_UPDATE",String(id));return send(res,200,{ok:true})}

  // Activity log
  if(u.pathname==="/api/admin/activity"&&req.method==="GET")return send(res,200,db.prepare("SELECT l.*,a.username FROM activity_log l LEFT JOIN admins a ON a.id=l.admin_id ORDER BY l.id DESC LIMIT 200").all());

  // File manager metadata (URL based; actual file upload can be wired to storage later)
  if(u.pathname==="/api/admin/files"&&req.method==="GET")return send(res,200,db.prepare("SELECT * FROM files ORDER BY id DESC").all());
  if(u.pathname==="/api/admin/file"&&req.method==="POST"){let b=await body(req);db.prepare("INSERT INTO files(name,url,type) VALUES(?,?,?)").run(b.name,b.url,b.type||"image");log(s.id,"FILE_ADD",b.name);return send(res,201,{ok:true})}
  if(u.pathname.startsWith("/api/admin/file/")&&req.method==="DELETE"){let id=+u.pathname.split("/").pop();db.prepare("DELETE FROM files WHERE id=?").run(id);log(s.id,"FILE_DELETE",String(id));return send(res,200,{ok:true})}

  // JSON database backup
  if(u.pathname==="/api/admin/backup"&&req.method==="GET"){
    const data={created_at:new Date().toISOString(),settings:settings(),categories:db.prepare("SELECT * FROM categories").all(),products:db.prepare("SELECT * FROM products").all(),gallery:db.prepare("SELECT * FROM gallery").all(),enquiries:db.prepare("SELECT * FROM enquiries").all(),admins:db.prepare("SELECT id,username,full_name,role,active,created_at FROM admins").all()};
    return send(res,200,data,"application/json",{"Content-Disposition":'attachment; filename="naveen-v8-backup.json"'});
  }
  return send(res,404,{error:"Admin API route not found"});
}
const mime={".html":"text/html; charset=utf-8",".css":"text/css",".js":"application/javascript",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".svg":"image/svg+xml",".ico":"image/x-icon"};
http.createServer(async(req,res)=>{try{let u=new URL(req.url,"http://localhost");if(u.pathname.startsWith("/api/")){let h=await api(req,res,u);if(h!==false)return}let f=u.pathname==="/"?"index.html":u.pathname==="/admin"?"admin/index.html":u.pathname.replace(/^\/+/,"");let fp=path.join(ROOT,path.normalize(f));if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory())return send(res,404,{error:"Not found"});send(res,200,fs.readFileSync(fp),mime[path.extname(fp).toLowerCase()]||"application/octet-stream")}catch(e){console.error(e);send(res,500,{error:"Server error"})}}).listen(PORT,()=>console.log("Naveen V8 FINAL: http://localhost:"+PORT));
