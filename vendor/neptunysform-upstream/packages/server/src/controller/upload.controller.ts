import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { Model } from 'mongoose'
import { extname } from 'path'

import { getMulterStorage } from '@config'
import { StoredUploadModel } from '@model'
import { S3_PUBLIC_URL, UPLOAD_FILE_SIZE, UPLOAD_FILE_TYPES } from '@environments'
import { helper, nanoid } from '@neptunysform-inc/utils'

@Controller()
export class UploadController {
  constructor(
    @InjectModel(StoredUploadModel.name)
    private readonly storedUploadModel: Model<StoredUploadModel>
  ) {}

  @Get('/api/upload/:key')
  async show(@Param('key') key: string, @Res() res: Response) {
    const storedUpload = await this.storedUploadModel.findOne({ key }).exec()

    if (!storedUpload) {
      throw new NotFoundException('Upload not found')
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('Content-Length', String(storedUpload.size))
    res.contentType(storedUpload.mimeType)

    return res.send(storedUpload.content)
  }

  @Post('/api/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: UPLOAD_FILE_SIZE
      },
      fileFilter: (req: any, file: any, cb: any) => {
        if (UPLOAD_FILE_TYPES.includes(file.mimetype)) {
          cb(null, true)
        } else {
          cb(new BadRequestException(`Unsupported file type ${extname(file.originalname)}`), false)
        }
      },
      storage: getMulterStorage()
    })
  )
  async index(@UploadedFile() file: any): Promise<{ filename: string; url: string; size: number }> {
    let url: string = `/static/upload/${encodeURIComponent(file.filename)}`

    if (file.location) {
      if (helper.isValid(S3_PUBLIC_URL)) {
        url = `${S3_PUBLIC_URL.replace(/\/+$/, '')}/${file.key}`
      } else {
        url = file.location
      }
    } else if (file.buffer) {
      const key = `${nanoid(12)}-${file.originalname}`

      await this.storedUploadModel.create({
        key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        content: file.buffer
      })

      url = `/api/upload/${encodeURIComponent(key)}`
    }

    return {
      filename: file.originalname,
      size: file.size,
      url
    }
  }
}
