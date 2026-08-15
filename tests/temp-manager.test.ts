import { describe, expect, it } from 'vitest'
import { isTempArtifact, planCleanup, type TempFile } from '../src/main/services/TempManager'

const MIN = 60_000
const NOW = 1_700_000_000_000

const f = (name: string, ageMinutes = 60, size = 1024): TempFile => ({
  name,
  path: `C:\\out\\${name}`,
  size,
  mtimeMs: NOW - ageMinutes * MIN
})

describe('isTempArtifact — nhan dien file rac', () => {
  it('nhan dien file tai do dang', () => {
    expect(isTempArtifact('video.mp4.part')).toBe(true)
    expect(isTempArtifact('video.f137.mp4.part')).toBe(true)
    expect(isTempArtifact('video.mp4.ytdl')).toBe(true)
  })

  it('nhan dien luong rieng le chua ghep', () => {
    expect(isTempArtifact('Big Buck Bunny [id].f137.mp4')).toBe(true)
    expect(isTempArtifact('Big Buck Bunny [id].f251.webm')).toBe(true)
  })

  it('nhan dien anh bia con lai', () => {
    expect(isTempArtifact('video.webp')).toBe(true)
    expect(isTempArtifact('video.jpg')).toBe(true)
  })

  it('KHONG coi video hoan chinh la rac', () => {
    expect(isTempArtifact('Blender Conference 2025 Recap [aK24bXXn-NY].mp4')).toBe(false)
    expect(isTempArtifact('bai hat.mp3')).toBe(false)
    expect(isTempArtifact('phim.mkv')).toBe(false)
    expect(isTempArtifact('video.m4a')).toBe(false)
  })

  it('KHONG coi phu de la rac — nguoi dung co the muon giu file roi', () => {
    expect(isTempArtifact('video.vi.srt')).toBe(false)
    expect(isTempArtifact('video.en.vtt')).toBe(false)
  })

  it('ten chua chu part nhung khong phai duoi .part thi khong phai rac', () => {
    expect(isTempArtifact('Participate in the party.mp4')).toBe(false)
    expect(isTempArtifact('partition guide.mp4')).toBe(false)
  })
})

describe('planCleanup — KHONG duoc xoa file cua job dang cho tiep tuc', () => {
  it('giu .part khi job dang tam dung dung ten do', () => {
    const files = [f('Video A.mp4.part'), f('Video B.mp4.part')]
    const plan = planCleanup(files, ['Video A'], NOW, 10 * MIN)
    const names = plan.remove.map((x) => x.name)
    expect(names).not.toContain('Video A.mp4.part')
    expect(names).toContain('Video B.mp4.part')
  })

  it('giu ca luong rieng le cua job dang hoat dong', () => {
    const files = [f('Video A.f137.mp4'), f('Video A.f251.webm'), f('Video C.f137.mp4')]
    const plan = planCleanup(files, ['Video A'], NOW, 10 * MIN)
    expect(plan.remove.map((x) => x.name)).toEqual(['Video C.f137.mp4'])
  })

  it('bao ve khop theo tien to, khong phu thuoc phan mo rong', () => {
    const files = [f('Video A.webp'), f('Video A.mp4.ytdl')]
    const plan = planCleanup(files, ['Video A'], NOW, 10 * MIN)
    expect(plan.remove).toHaveLength(0)
  })

  it('khong co job nao thi don het rac', () => {
    const files = [f('a.mp4.part'), f('b.f137.mp4'), f('c.webp')]
    expect(planCleanup(files, [], NOW, 10 * MIN).remove).toHaveLength(3)
  })
})

describe('planCleanup — nguong tuoi tranh xoa file dang duoc ghi', () => {
  it('giu file vua duoc dong vao', () => {
    const files = [f('moi.mp4.part', 1)]
    expect(planCleanup(files, [], NOW, 10 * MIN).remove).toHaveLength(0)
  })

  it('don file da cu', () => {
    const files = [f('cu.mp4.part', 120)]
    expect(planCleanup(files, [], NOW, 10 * MIN).remove).toHaveLength(1)
  })

  it('nguong 0 thi don bat ke tuoi', () => {
    expect(planCleanup([f('moi.mp4.part', 0)], [], NOW, 0).remove).toHaveLength(1)
  })
})

describe('planCleanup — bao cao ket qua', () => {
  it('cong don dung tong dung luong se giai phong', () => {
    const files = [f('a.mp4.part', 60, 1_000_000), f('b.webp', 60, 500_000), f('giu.mp4', 60, 9_000_000)]
    const plan = planCleanup(files, [], NOW, 10 * MIN)
    expect(plan.bytes).toBe(1_500_000)
  })

  it('video hoan chinh khong bao gio nam trong danh sach xoa', () => {
    const files = [f('phim hay.mp4', 999, 5_000_000), f('rac.mp4.part')]
    const plan = planCleanup(files, [], NOW, 10 * MIN)
    expect(plan.remove.map((x) => x.name)).toEqual(['rac.mp4.part'])
  })

  it('khong co gi de don thi tra ve danh sach rong, khong loi', () => {
    const plan = planCleanup([], [], NOW, 10 * MIN)
    expect(plan.remove).toEqual([])
    expect(plan.bytes).toBe(0)
  })
})
