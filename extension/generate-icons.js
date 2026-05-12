#!/usr/bin/env node
'use strict'

/**
 * Generates icons/icon16.png, icon48.png, icon128.png
 * Run once: node extension/generate-icons.js
 */

import { deflateSync } from 'zlib'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type)
  const payload = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(payload))
  return Buffer.concat([len, payload, crcBuf])
}

function makePNG(size, [r, g, b]) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB

  const rad = Math.round(size * 0.22)
  const rowLen = 1 + size * 3
  const raw = Buffer.alloc(size * rowLen)

  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      // Rounded corners: pixels outside the corner radius are white
      let pr = r, pg = g, pb = b
      const inCorner =
        (x < rad || x >= size - rad) &&
        (y < rad || y >= size - rad)
      if (inCorner) {
        const cx = x < size / 2 ? rad : size - 1 - rad
        const cy = y < size / 2 ? rad : size - 1 - rad
        const dx = x - cx, dy = y - cy
        if (Math.sqrt(dx * dx + dy * dy) > rad) {
          pr = 255; pg = 255; pb = 255
        }
      }
      const i = y * rowLen + 1 + x * 3
      raw[i] = pr; raw[i + 1] = pg; raw[i + 2] = pb
    }
  }

  const idat = deflateSync(raw)

  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

const iconsDir = join(__dirname, 'icons')
if (!existsSync(iconsDir)) mkdirSync(iconsDir)

// Gray-900 #111827 = (17, 24, 39)
const color = [17, 24, 39]

for (const size of [16, 48, 128]) {
  const png = makePNG(size, color)
  const outPath = join(iconsDir, `icon${size}.png`)
  writeFileSync(outPath, png)
  console.log(`  icon${size}.png`)
}

console.log('\nDone! Load the extension in Chrome:\n  chrome://extensions → Load unpacked → select the extension/ folder')
