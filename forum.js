const $ = selector => document.querySelector(selector)
const main = $('#page-content')
const state = { me:null,admin:false,view:'feed',sort:'trending',category:'all',tag:'',query:'',author:'',page:0,hasMore:false,posts:[],activePost:null,activeProfile:null,notifications:[],editingPost:null,loading:false,request:0 }
const categories = ['all','discussion','question','guide','news','showcase','feedback']
const token = () => localStorage.getItem('Token') || ''
let apiHost = ''
let apiOriginPromise = null
async function resolveApiHost(){
  if(apiOriginPromise)return apiOriginPromise
  apiOriginPromise=(async()=>{
    const response=await fetch('/server.txt',{cache:'no-store'})
    if(!response.ok)throw new Error('Unable to discover API server')
    const raw=(await response.text()).trim()
    const host=new URL(raw)
    if(host.protocol!=='https:'&&host.hostname!=='localhost')throw new Error('Invalid API server')
    apiHost=host.origin
    return apiHost
  })()
  return apiOriginPromise
}
const imageUrl = path => apiHost + path
const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const clip = (value,size) => String(value||'').length > size ? String(value).slice(0,size).trimEnd()+'…' : String(value||'')
const relative = ts => { const delta=Math.max(0,Date.now()-Number(ts||0)), mins=Math.floor(delta/60000);return mins<1?'Just now':mins<60?mins+'m ago':mins<1440?Math.floor(mins/60)+'h ago':mins<10080?Math.floor(mins/1440)+'d ago':new Date(Number(ts)).toLocaleDateString() }
const formatNum = n => Intl.NumberFormat('en',{notation:Number(n)>=10000?'compact':'standard',maximumFractionDigits:1}).format(Number(n)||0)
const avatar = (name,extra='') => `<span class="avatar ${extra}">${esc(String(name||'?').charAt(0).toUpperCase())}</span>`
const tagButton = name => `<button class="tag" data-action="tag" data-tag="${esc(name)}">#${esc(name)}</button>`
const toast = (text,error=false) => { const item=document.createElement('div');item.className='toast'+(error?' error-text':'');item.textContent=text;$('#toasts').appendChild(item);setTimeout(()=>item.remove(),4300) }
async function api(path,options={}) {
  const headers={...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}),...options.headers}
  if(token())headers.Authorization='Bearer '+token()
  const host=await resolveApiHost()
  const result=await fetch(host+'/api/forum'+path,{...options,headers,cache:'no-store'})
  const data=await result.json().catch(()=>({error:'Invalid server response'}))
  if(!result.ok || data.success===false)throw new Error(data.error||'Request failed')
  return data
}
const postImage = p => p.images?.length ? `<div class="preview-thumb">${p.images.slice(0,3).map(x=>`<img src="${esc(imageUrl(x.url))}" loading="lazy" alt="Post attachment">`).join('')}${p.images.length>3?`<span class="muted">+${p.images.length-3}</span>`:''}</div>` : ''
const tags = p => p.tags?.length?`<div class="tags">${p.tags.map(tagButton).join('')}</div>`:''
const postMeta = p => `<div class="post-author-line">${avatar(p.author)}<div class="post-author-info"><button class="user-link" data-action="profile" data-username="${esc(p.author)}">${esc(p.author)}${p.author.toLowerCase()==='somin'?' <span class="verified">✦</span>':''}</button><small>${relative(p.createdAt)}${p.editedBy?' · Edited':''} · ${formatNum(p.views)} views</small></div><span class="post-category">${esc(p.category)}</span></div>`
const adminSelect = (p,type='post') => `<select class="admin-choice" data-type="${type}" data-id="${esc(p.id)}" aria-label="Moderation action"><option value="">Manage</option><option value="review">Take down for review</option><option value="restore">Restore</option><option value="delete">Delete</option>${type==='post'?`<option value="${p.pinned?'unpin':'pin'}">${p.pinned?'Unpin':'Pin'} post</option><option value="${p.locked?'unlock':'lock'}">${p.locked?'Unlock':'Lock'} replies</option>`:''}</select>`
const actions = (p,detail=false) => `<div class="post-card-bottom"><button class="stat-button ${p.vote===1?'selected':''}" data-action="vote" data-type="post" data-id="${p.id}" data-value="${p.vote===1?0:1}" title="Upvote"><span class="sym">↑</span> ${formatNum(p.score)}</button><button class="stat-button" data-action="post" data-id="${p.id}"><span class="sym">▤</span> ${formatNum(p.replies)}</button><button class="stat-button ${p.saved?'selected':''}" data-action="save" data-id="${p.id}"><span class="sym">${p.saved?'◆':'◇'}</span> ${p.saved?'Saved':'Save'}</button><span class="card-spacer"></span>${p.pinned?'<span class="pin-label">⌁ Pinned</span>':''}${p.locked?'<span class="pin-label">Locked</span>':''}${(p.mine||state.admin)?`<button class="text-link" data-action="edit-post" data-id="${p.id}">Edit</button>`:''}${state.admin?adminSelect(p):''}</div>`
const card = p => `<article class="post-card" data-post="${p.id}">${postMeta(p)}<h3 class="post-title" data-action="post" data-id="${p.id}">${esc(p.title)}</h3><p class="post-excerpt">${esc(clip(p.content,260))}</p>${tags(p)}${postImage(p)}${actions(p)}</article>`
const renderEmpty = (name,message) => `<div class="empty-card"><strong>${esc(name)}</strong>${esc(message)}</div>`
function setHeader(text) {$('#breadcrumb').textContent=text}
function hideHero(hidden) {$('#hero').hidden=hidden}
function activeNav(sort) { document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',state.view==='feed' && el.dataset.sort===sort)) }
function updateURL(params={},replace=false){const url=new URL(location.href);url.search='';for(const [k,v] of Object.entries(params))if(v)url.searchParams.set(k,v);history[replace?'replaceState':'pushState']({},'',url)}
async function loadBootstrap(){
  const result=await api('/bootstrap')
  state.me=result.me?.username||null;state.admin=!!result.me?.admin
  $('#account-name').textContent=state.me||'Sign in'
  $('#account-avatar').textContent=(state.me||'?').charAt(0).toUpperCase()
  $('#moderation-link').hidden=!state.admin
  $('#community-stats').innerHTML=`<div><strong>${formatNum(result.stats.posts)}</strong><small>Posts</small></div><div><strong>${formatNum(result.stats.replies)}</strong><small>Replies</small></div><div><strong>${formatNum(result.stats.members)}</strong><small>Members</small></div>`
  $('#trending-tags').innerHTML=result.tags?.length?result.tags.map(x=>`<button class="topic-row" data-action="tag" data-tag="${esc(x.tag)}"><span>#${esc(x.tag)}</span><small>${formatNum(x.count)}</small></button>`).join(''):'<div class="muted">Be the first to start a topic.</div>'
  $('#somin-followers').textContent=formatNum(result.featured.followers)+' followers'
  if(state.me)refreshNotifications(false)
}
async function showFeed(sort='trending',opts={}) {
  state.view='feed';state.sort=sort;state.category=opts.category||'all';state.tag=opts.tag||'';state.query=opts.q||'';state.author=opts.author||'';state.page=0;state.hasMore=false;state.posts=[];state.loading=false;state.request++
  hideHero(false);activeNav(sort)
  $('#global-search').value=state.query
  setHeader(state.tag?'#'+state.tag:state.query?'Search':state.author?'Posts by '+state.author:'Discover')
  if(!opts.noHistory)updateURL({sort:sort==='trending'?'':sort,tag:state.tag,category:state.category==='all'?'':state.category,q:state.query,author:state.author})
  main.innerHTML=`<div class="section-head"><div><h2>${state.query?'Search results':state.tag?'#'+esc(state.tag):state.author?'Posts by '+esc(state.author):'Explore discussions'}</h2><p>${state.query?'Looking for “'+esc(state.query)+'”':'Fresh ideas, great conversations.'}</p></div><div class="section-head-right"><select class="sort-select" id="sort-select" aria-label="Sort posts"><option value="trending">Trending now</option><option value="latest">Latest</option><option value="active">Recently active</option><option value="topweek">Top this week</option><option value="top">Top all time</option><option value="unanswered">Unanswered</option><option value="following">Following</option><option value="saved">Saved</option></select></div></div><div class="tab-strip" id="category-tabs">${categories.map(c=>`<button class="${state.category===c?'active':''}" data-action="category" data-category="${c}">${c==='all'?'All posts':c[0].toUpperCase()+c.slice(1)}</button>`).join('')}</div><div id="post-list"><div class="loading-card"><span class="loader"></span> Finding posts...</div></div><div id="more-feed"></div>`
  $('#sort-select').value=['trending','latest','active','topweek','top','unanswered','following','saved'].includes(sort)?sort:'trending'
  await fetchPosts()
}
async function fetchPosts(){
  if(state.loading)return
  state.loading=true
  const request=++state.request
  const first=state.page===0
  const params=new URLSearchParams({sort:state.sort,page:String(state.page),limit:'15'})
  if(state.category!=='all')params.set('category',state.category)
  if(state.tag)params.set('tag',state.tag)
  if(state.query)params.set('q',state.query)
  if(state.author)params.set('author',state.author)
  $('#more-feed').innerHTML='<div class="loading-card"><span class="loader"></span> Loading...</div>'
  try {
    const response=await api('/posts?'+params)
    if(request!==state.request||state.view!=='feed')return
    state.posts.push(...response.posts)
    state.hasMore=response.hasMore
    $('#post-list').innerHTML=state.posts.length?state.posts.map(card).join(''):renderEmpty('Nothing here yet','Try another category, tag, or search term.')
    $('#more-feed').innerHTML=response.hasMore?'<button class="load-more" data-action="more-feed">Load more posts ↓</button>':''
  }catch(e){if(request===state.request) { if(first)$('#post-list').innerHTML=renderEmpty('Unable to load posts',e.message);$('#more-feed').innerHTML='';toast(e.message,true) }}
  finally{state.loading=false}
}
async function showPost(postId, noHistory=false){
  state.view='post';state.activePost=null;hideHero(true);activeNav('');setHeader('Discussion')
  if(!noHistory)updateURL({post:postId})
  main.innerHTML='<div class="loading-card"><span class="loader"></span> Opening discussion...</div>'
  try{
    const data=await api('/posts/'+encodeURIComponent(postId));if(state.view!=='post')return
    const p=data.post;state.activePost=p
    const content=`<button class="detail-back" data-action="back">← Back to discussions</button><div class="detail-card">${postMeta(p)}<h1>${esc(p.title)}</h1>${tags(p)}<div class="detail-content">${esc(p.content)}</div>${p.images?.length?`<div class="post-media">${p.images.map(x=>`<a target="_blank" rel="noopener" href="${esc(imageUrl(x.url))}"><img src="${esc(imageUrl(x.url))}" alt="Attachment" loading="lazy"></a>`).join('')}</div>`:''}${p.status==='review'?`<p class="error-text">This post is under review. ${esc(p.reason)}</p>`:''}${actions(p,true)}</div><section class="reply-section"><h2>${formatNum(p.replies)} replies</h2><div id="root-replies"></div><div id="root-more"></div>${p.locked?`<div class="empty-card">This discussion is locked to new replies.</div>`:`<div class="compose-inline"><h3>Add to the conversation</h3>${replyForm(p.id,null)}</div>`}</section>`
    main.innerHTML=content
    await loadReplies(p.id,null,0)
  }catch(e){main.innerHTML=renderEmpty('Discussion unavailable',e.message);toast(e.message,true)}
}
function replyForm(postId,parentId){return `<form class="reply-form" data-parent="${esc(parentId||'')}" data-post="${esc(postId)}"><textarea name="content" placeholder="Write your reply..." maxlength="5000" required></textarea><div class="reply-form-bottom"><button type="button" class="soft-button" data-action="cancel-reply">Cancel</button><button type="submit" class="primary-button">Reply ↗</button></div></form>`}
function replyHTML(r){return `<article class="reply-card ${r.status==='deleted'?'deleted':''}" id="reply-${r.id}"><div class="reply-head">${avatar(r.author)}<button class="user-link" data-action="profile" data-username="${esc(r.author)}">${esc(r.author)}</button><small>${relative(r.createdAt)}${r.editedBy?' · Edited':''}</small></div><p class="reply-body">${r.status==='deleted'?'[This reply was deleted]':esc(r.content)}</p><div class="reply-footer">${r.status==='published'?`<button class="stat-button ${r.vote===1?'selected':''}" data-action="vote" data-type="reply" data-id="${r.id}" data-value="${r.vote===1?0:1}"><span class="sym">↑</span> ${formatNum(r.score)}</button><button class="text-link" data-action="reply-to" data-id="${r.id}">Reply</button>${(r.mine||state.admin)?`<button class="text-link" data-action="edit-reply" data-id="${r.id}">Edit</button>`:''}`:''}${r.children?`<button class="text-link" data-action="expand-replies" data-id="${r.id}" data-page="0">${r.children} ${r.children===1?'reply':'replies'} ↓</button>`:''}${state.admin?adminSelect(r,'reply'):''}</div><div class="reply-editor" id="editor-${r.id}"></div><div class="reply-children" id="children-${r.id}" hidden></div></article>`}
async function loadReplies(postId,parentId,page=0){
  const target=parentId?$('#children-'+parentId):$('#root-replies')
  if(!target)return
  if(parentId)target.hidden=false
  if(page===0)target.innerHTML='<div class="muted"><span class="loader"></span> Loading replies</div>'
  try{
    const params=new URLSearchParams({parent:parentId||'root',page:String(page),limit:'20'})
    const data=await api('/posts/'+encodeURIComponent(postId)+'/replies?'+params)
    if(state.activePost?.id!==postId)return
    if(page===0)target.innerHTML=''
    for(const r of data.replies)target.insertAdjacentHTML('beforeend',replyHTML(r))
    if(data.hasMore)target.insertAdjacentHTML('beforeend',`<button class="load-more" data-action="more-replies" data-parent="${esc(parentId||'')}" data-page="${page+1}">Load more replies ↓</button>`)
    if(!parentId&&!page&&!data.replies.length)target.innerHTML='<p class="muted">No replies yet. Start the discussion.</p>'
  }catch(e){target.innerHTML=renderEmpty('Unable to load replies',e.message)}
}
async function showProfile(name,noHistory=false){
  state.view='profile';hideHero(true);setHeader('Member profile');activeNav('')
  if(!noHistory)updateURL({user:name})
  main.innerHTML='<div class="loading-card"><span class="loader"></span> Loading member...</div>'
  try{
    const response=await api('/users/'+encodeURIComponent(name)),user=response.user
    if(state.view!=='profile')return
    state.activeProfile=user
    const mine=state.me&&state.me.toLowerCase()===user.username.toLowerCase()
    const followLabel=user.username.toLowerCase()==='somin'?'✓ Following (required)':user.followed?'✓ Following':'+ Follow'
    const button=mine?'':`<button class="${user.followed?'soft-button':'primary-button'}" data-action="follow" data-username="${esc(user.username)}" ${user.canUnfollow?'':'disabled'}>${followLabel}</button>`
    main.innerHTML=`<div class="profile-banner">${avatar(user.username)}<div class="profile-meta"><h1>${esc(user.username)}${user.username.toLowerCase()==='somin'?' <span class="verified">✦</span>':''}</h1><small>Zyphor Community member</small><div class="profile-stats"><span><strong id="profile-followers">${formatNum(user.followers)}</strong> followers</span><span><strong>${formatNum(user.following)}</strong> following</span><span><strong>${formatNum(user.posts)}</strong> posts</span><span><strong>${formatNum(user.replies)}</strong> replies</span></div></div><div id="follow-controls">${button}</div></div><div class="section-head"><div><h2>Posts by ${esc(user.username)}</h2><p>Conversations and contributions</p></div></div><div id="profile-posts" class="loading-card"><span class="loader"></span> Finding posts...</div>`
    const params=new URLSearchParams({author:user.username,sort:'latest',limit:'20'})
    const posts=await api('/posts?'+params)
    $('#profile-posts').className=''
    $('#profile-posts').innerHTML=posts.posts.length?posts.posts.map(card).join(''):renderEmpty('No published posts yet','There are no discussions from this member.')
  }catch(e){main.innerHTML=renderEmpty('Profile unavailable',e.message)}
}
async function refreshNotifications(show=true){
  if(!state.me)return
  try{
    const data=await api('/notifications')
    state.notifications=data.notifications
    $('#sidebar-unread').hidden=!data.unread
    $('#bell-dot').hidden=!data.unread
    $('#sidebar-unread').textContent=data.unread>99?'99+':data.unread
    if(show&&state.view==='notifications')renderNotifications()
  }catch(e){if(show)toast(e.message,true)}
}
function renderNotifications(){
  const notifications=state.notifications
  main.innerHTML=`<div class="section-head"><div><h2>Notifications</h2><p>Updates from people you follow and your conversations.</p></div><button class="soft-button" data-action="read-all">Mark all read</button></div>${notifications.length?notifications.map(n=>`<div class="notice-card ${n.seen?'':'unread'}" id="notification-${esc(n.id)}"><div class="notice-icon">${n.kind==='follow_post'?'✦':n.kind==='moderation'?'⚑':'↳'}</div><div class="notice-copy"><strong>${esc(n.actor)} ${n.kind==='follow_post'?'posted something new':n.kind==='moderation'?'updated moderation status':'replied to your discussion'}</strong><p>${esc(clip(n.body,180))}</p><small>${relative(n.createdAt)}</small></div><button class="text-link" data-action="open-notice" data-id="${esc(n.id)}" data-post="${esc(n.postId||'')}">View ↗</button></div>`).join(''):renderEmpty('All caught up','New posts from people you follow and replies will appear here.')}`
}
async function showNotifications(noHistory=false){
  if(!requireLogin())return
  state.view='notifications';hideHero(true);activeNav('');setHeader('Notifications')
  if(!noHistory)updateURL({tab:'notifications'})
  main.innerHTML='<div class="loading-card"><span class="loader"></span> Loading notifications...</div>'
  await refreshNotifications(true)
}
async function showModeration(noHistory=false){
  if(!state.admin){toast('Administrator permission required',true);return}
  state.view='moderation';hideHero(true);activeNav('');setHeader('Moderation')
  if(!noHistory)updateURL({tab:'moderation'})
  main.innerHTML='<div class="loading-card"><span class="loader"></span> Loading review queue...</div>'
  try {
    const data=await api('/admin/queue')
    const reviewCount=data.posts.length+(data.replies?.length||0)
    const reviewedReplies=(data.replies||[]).map(r=>`<div class="moderation-item"><div class="post-author-line">${avatar(r.author)}<div><strong>${esc(r.author)} · Reply</strong><small class="muted"> · ${relative(r.updated_at)}</small></div></div><p>${esc(clip(r.content,600))}</p><div class="moderation-controls"><button data-action="post" data-id="${r.post_id}">Open discussion</button><button data-action="moderate" data-id="${r.id}" data-type="reply" data-moderation="restore">Restore reply</button><button data-action="moderate" data-id="${r.id}" data-type="reply" data-moderation="delete">Delete reply</button></div></div>`).join('')
    const reviewedPosts=data.posts.map(p=>`<div class="moderation-item"><div class="post-author-line">${avatar(p.author)}<div><strong>${esc(p.author)} · Post</strong><small class="muted"> · ${relative(p.updatedAt)}</small></div></div><h3>${esc(p.title)}</h3><p>${esc(clip(p.content,600))}</p><div class="moderation-controls"><button data-action="post" data-id="${p.id}">Open post</button><button data-action="moderate" data-id="${p.id}" data-type="post" data-moderation="restore">Restore</button><button data-action="moderate" data-id="${p.id}" data-type="post" data-moderation="delete">Delete</button></div></div>`).join('')
    main.innerHTML=`<div class="section-head"><div><h2>Content moderation</h2><p>Posts and replies awaiting an administrator decision.</p></div><span class="post-category">${reviewCount} in review</span></div>${reviewCount?reviewedPosts+reviewedReplies:renderEmpty('Review queue is empty','There is no content currently under review.')}<div class="section-head" style="margin-top:28px"><h2>Recent moderator actions</h2></div>${data.history.length?`<div class="rail-card">${data.history.map(m=>`<div class="notice-card"><div class="notice-copy"><strong>${esc(m.admin)} · ${esc(m.action)}</strong><p>${esc(m.target_type)} ${esc(m.target_id)}${m.reason?' · '+esc(m.reason):''}</p><small>${relative(m.created_at)}</small></div></div>`).join('')}</div>`:renderEmpty('No moderation actions','Actions will appear here.')}`
  }catch(e){main.innerHTML=renderEmpty('Moderation unavailable',e.message)}
}
function requireLogin(){if(state.me)return true;toast('Please sign in to Zyphor first.',true);return false}
function openCompose(post=null){
  if(!requireLogin())return
  state.editingPost=post?.id||null
  $('#compose-form').reset()
  $('#dialog-title').textContent=post?'Edit discussion':'Create a new post'
  $('#post-title').value=post?.title||''
  $('#post-content').value=post?.content||''
  $('#post-category').value=post?.category||'discussion'
  $('#post-tags').value=post?.tags?.map(t=>'#'+t).join(' ')||''
  $('#image-preview').innerHTML=''
  $('#post-images').closest('.upload-zone').hidden=!!post
  $('#post-images').closest('.upload-zone').previousElementSibling.hidden=!!post
  $('#submit-post').textContent=post?'Save changes':'Publish post ↗'
  $('#compose-dialog').showModal()
}
async function submitPost(e){
  e.preventDefault();const btn=$('#submit-post');btn.disabled=true
  try {
    let response
    if(state.editingPost){
      const data={title:$('#post-title').value,content:$('#post-content').value,category:$('#post-category').value,tags:$('#post-tags').value}
      response=await api('/posts/'+encodeURIComponent(state.editingPost),{method:'PATCH',body:JSON.stringify(data)})
    } else {
      const form=new FormData($('#compose-form'))
      if($('#post-images').files.length>4)throw new Error('Maximum 4 images per post')
      response=await api('/posts',{method:'POST',body:form})
    }
    $('#compose-dialog').close();toast(state.editingPost?'Post updated':'Post published')
    const postId=response.postId||state.editingPost
    await showPost(postId)
    loadBootstrap().catch(()=>{})
  }catch(e){toast(e.message,true)}finally{btn.disabled=false}
}
async function voteOn(type,id,value){if(!requireLogin())return;try{await api('/vote',{method:'POST',body:JSON.stringify({type,id,value:Number(value)})});if(state.view==='post'&&state.activePost){if(type==='post')await showPost(state.activePost.id,true);else await loadReplies(state.activePost.id,null,0)}else if(state.view==='feed'){const p=state.posts.find(p=>p.id===id);if(p){p.score+=Number(value)-(p.vote||0);p.vote=Number(value);$('#post-list').innerHTML=state.posts.map(card).join('')}}else if(state.view==='profile'&&state.activeProfile)await showProfile(state.activeProfile.username,true)}catch(e){toast(e.message,true)}}
async function toggleSave(id){if(!requireLogin())return;try{const r=await api('/posts/'+id+'/save',{method:'POST',body:'{}'});toast(r.saved?'Post saved':'Removed from bookmarks');if(state.view==='feed'){const p=state.posts.find(p=>p.id===id);if(p){p.saved=r.saved;$('#post-list').innerHTML=state.posts.map(card).join('')}}else if(state.view==='post'){state.activePost.saved=r.saved;await showPost(id,true)}}catch(e){toast(e.message,true)}}
async function moderate(type,id,action){if(!state.admin)return;const needsReason=['review','delete'].includes(action);const reason=needsReason?prompt('Reason for '+action+' (optional):',''):'';if(needsReason&&reason===null)return;if(action==='delete'&&!confirm('Delete this '+type+'? This cannot be undone.'))return;try{await api('/admin/moderate',{method:'POST',body:JSON.stringify({type,id,action,reason})});toast('Moderation action: '+action);if(state.view==='moderation')await showModeration(true);else if(state.view==='post')await showPost(state.activePost?.id||id,true);else if(state.view==='feed')await showFeed(state.sort,{category:state.category,tag:state.tag,q:state.query,author:state.author,noHistory:true})}catch(e){toast(e.message,true)}}
async function follow(who){if(!requireLogin())return;const profile=state.activeProfile;if(!profile||who.toLowerCase()==='somin')return;try{const r=await api('/users/'+encodeURIComponent(who)+'/follow',{method:profile.followed?'DELETE':'POST',body:'{}'});profile.followed=r.following;profile.followers=r.followers;await showProfile(who,true);toast(r.following?'Following '+who:'Unfollowed '+who)}catch(e){toast(e.message,true)}}
function closeMenu(){$('#sidebar').classList.remove('open');$('#sidebar-backdrop').classList.remove('visible')}
async function showRoute(){const q=new URLSearchParams(location.search);if(q.has('post'))await showPost(q.get('post'),true);else if(q.has('user'))await showProfile(q.get('user'),true);else if(q.get('tab')==='notifications')await showNotifications(true);else if(q.get('tab')==='moderation')await showModeration(true);else await showFeed(q.get('sort')||'trending',{category:q.get('category')||'all',tag:q.get('tag')||'',q:q.get('q')||'',author:q.get('author')||'',noHistory:true})}
$('#compose-form').addEventListener('submit',submitPost)
$('#post-images').addEventListener('change',e=>{const files=Array.from(e.target.files);if(files.length>4){toast('You can select up to 4 images.',true);e.target.value='';return}$('#image-preview').innerHTML='';for(const file of files){const url=URL.createObjectURL(file);const img=document.createElement('img');img.src=url;img.onload=()=>URL.revokeObjectURL(url);$('#image-preview').appendChild(img)}})
$('#search-form').addEventListener('submit',e=>{e.preventDefault();showFeed('latest',{q:$('#global-search').value.trim()})})
$('#menu-toggle').addEventListener('click',()=>{$('#sidebar').classList.add('open');$('#sidebar-backdrop').classList.add('visible')})
$('#close-sidebar').addEventListener('click',closeMenu)
$('#sidebar-backdrop').addEventListener('click',closeMenu)
window.addEventListener('popstate',showRoute)
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();$('#global-search').focus()}if(e.key==='Escape')closeMenu()})
document.addEventListener('change',e=>{
  if(e.target.id==='sort-select')showFeed(e.target.value,{category:state.category,tag:state.tag,q:state.query,author:state.author})
  if(e.target.classList.contains('admin-choice')&&e.target.value){const action=e.target.value;const type=e.target.dataset.type;const id=e.target.dataset.id;e.target.value='';moderate(type,id,action)}
})
document.addEventListener('submit',async e=>{
  if(!e.target.matches('.reply-form'))return
  e.preventDefault()
  if(!requireLogin())return
  const form=e.target,postId=form.dataset.post,parentId=form.dataset.parent||null,content=form.elements.content.value
  const submit=form.querySelector('button[type=submit]');submit.disabled=true
  try{
    await api('/posts/'+encodeURIComponent(postId)+'/replies',{method:'POST',body:JSON.stringify({content,parentId})})
    toast('Reply published')
    if(parentId){const target=$('#children-'+parentId);if(target)target.hidden=false;await loadReplies(postId,parentId,0);$('#editor-'+parentId).innerHTML=''}
    else {form.reset();await loadReplies(postId,null,0)}
    const p=state.activePost;if(p)p.replies++
  }catch(err){toast(err.message,true)}finally{submit.disabled=false}
})
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');if(!el)return
  if(el.tagName==='A'&&el.getAttribute('href'))return
  e.preventDefault();closeMenu()
  const action=el.dataset.action,id=el.dataset.id
  if(action==='feed')return showFeed(el.dataset.sort||'trending')
  if(action==='category')return showFeed(state.sort,{category:el.dataset.category,tag:state.tag,q:state.query,author:state.author})
  if(action==='tag')return showFeed('latest',{tag:el.dataset.tag})
  if(action==='post')return showPost(id)
  if(action==='back')return showFeed('trending')
  if(action==='profile')return showProfile(el.dataset.username)
  if(action==='profile-self'){if(requireLogin())return showProfile(state.me);return}
  if(action==='account'){if(state.me)return showProfile(state.me);location.href='/';return}
  if(action==='compose')return openCompose()
  if(action==='close-compose'){$('#compose-dialog').close();return}
  if(action==='more-feed'){state.page++;return fetchPosts()}
  if(action==='save')return toggleSave(id)
  if(action==='vote')return voteOn(el.dataset.type,id,el.dataset.value)
  if(action==='edit-post'){
    try{const post=state.activePost?.id===id?state.activePost:state.posts.find(p=>p.id===id)|| (await api('/posts/'+id)).post;return openCompose(post)}catch(err){return toast(err.message,true)}
  }
  if(action==='edit-reply'){
    const box=$('#reply-'+id),body=box?.querySelector('.reply-body');if(!body)return
    const updated=prompt('Edit reply:',body.textContent);if(updated===null)return
    try{await api('/replies/'+id,{method:'PATCH',body:JSON.stringify({content:updated})});toast('Reply updated');await loadReplies(state.activePost.id,null,0)}catch(err){toast(err.message,true)}return
  }
  if(action==='reply-to'){
    if(!requireLogin())return
    const target=$('#editor-'+id);if(!target)return
    target.innerHTML=replyForm(state.activePost.id,id);target.querySelector('textarea').focus();return
  }
  if(action==='cancel-reply'){const parent=el.closest('.reply-editor');if(parent)parent.innerHTML='';else el.closest('.reply-form')?.reset();return}
  if(action==='expand-replies')return loadReplies(state.activePost.id,id,0)
  if(action==='more-replies'){const parent=el.dataset.parent||null,pg=Number(el.dataset.page);el.remove();return loadReplies(state.activePost.id,parent,pg)}
  if(action==='notifications')return showNotifications()
  if(action==='read-all'){try{await api('/notifications/read',{method:'POST',body:JSON.stringify({all:true})});await refreshNotifications(true)}catch(err){toast(err.message,true)}return}
  if(action==='open-notice'){
    try{await api('/notifications/read',{method:'POST',body:JSON.stringify({id})});await showPost(el.dataset.post);refreshNotifications(false)}catch(err){toast(err.message,true)}return
  }
  if(action==='moderation')return showModeration()
  if(action==='moderate')return moderate(el.dataset.type,id,el.dataset.moderation)
  if(action==='follow')return follow(el.dataset.username)
})
;(async()=>{
  try{await loadBootstrap();await showRoute()}catch(e){main.innerHTML=renderEmpty('Connection failed','Unable to reach the community server. '+e.message)}
  setInterval(()=>{if(state.me&&!document.hidden)refreshNotifications(false)},60000)
})()
