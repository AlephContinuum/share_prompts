import { Router } from 'next/router';
import NewPost from './pages/NewPost';
import Post from './pages/Post';

const App = () => {
  return(
    <Router>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='about' element={<About />} />
        <Route path='posts' element={<Posts />}>
          <Route path='new' element={<NewPost />} />
          <Route path='postId' element={<Post />} />
        </Route>      
      </Routes>
    </Router>
  )
}

export default App;