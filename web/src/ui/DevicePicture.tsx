import type { CSSProperties, ReactNode } from 'react'
import { frameLayout, MARK_SCALE, pct, round } from '../data/frame'
import { pictureUrl } from '../data/load'
import type { Device, Frame } from '../data/types'
import { cx } from './cx'
import styles from './DevicePicture.module.css'

export interface PlacedMark {
  input: string
  x: number
  y: number
}

interface DevicePictureProps {
  device: Pick<Device, 'id' | 'pictures'>
  frame: Frame
  mark?: (mark: PlacedMark, index: number) => ReactNode
}

export function DevicePicture({ device, frame, mark }: DevicePictureProps) {
  const { width, height, placed, marks } = frameLayout(device, frame)
  const style = { aspectRatio: `${round(width)} / ${round(height)}`, '--ratio': round(width / height), '--w': round(MARK_SCALE * width / Math.max(width, height)) } as CSSProperties
  return (
    <div className={styles.picture} style={style}>
      {placed.map((p, i) => (
        <div key={i} className={styles.layer} style={{ left: pct(p.ax), top: pct(p.ay), width: pct(p.aw), height: pct(p.ah) }}>
          <img src={pictureUrl(device, p.picture)} alt=""
            style={{ left: pct(-p.c.x * 100 / p.c.w), top: pct(-p.c.y * 100 / p.c.h), width: pct(10000 / p.c.w), height: pct(10000 / p.c.h) }} />
        </div>
      ))}
      {mark && marks.map(mark)}
    </div>
  )
}

export const DeviceThumb = ({ device, small }: { device: Pick<Device, 'id' | 'pictures' | 'card'>; small?: boolean }) => (
  <div className={cx(styles.thumb, small && styles.small)}>{device.card && <DevicePicture device={device} frame={device.card} />}</div>
)
