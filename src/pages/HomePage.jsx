import { useEffect } from 'react'
import VideoFeed from '../components/VideoFeed'
import { applyHomeMetadata } from '../utils/seo'

export default function HomePage() {
  useEffect(() => { applyHomeMetadata() }, [])
  return <VideoFeed />
}
