import { Transform } from 'class-transformer'
import {
  IsIn,
  IsInt,
  Matches,
  IsOptional,
  IsString,
  IsUrl,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator'

import { APP_HOMEPAGE_URL, S3_PUBLIC_URL } from '@environments'

function getHostname(url?: string): string | undefined {
  if (!url) {
    return
  }

  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return
  }
}

const ALLOWED_IMAGE_HOSTS = [
  '127.0.0.1',
  'localhost',
  'secure.gravatar.com',
  'googleusercontent.com',
  'images.unsplash.com',
  'unsplash.com',
  getHostname(APP_HOMEPAGE_URL),
  getHostname(S3_PUBLIC_URL)
].filter(Boolean) as string[]

@ValidatorConstraint({ name: 'isAllowedImageUrl', async: false })
class IsAllowedImageUrlConstraint implements ValidatorConstraintInterface {
  validate(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase()

      return ALLOWED_IMAGE_HOSTS.some(
        allowedHost => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
      )
    } catch {
      return false
    }
  }

  defaultMessage(): string {
    return 'url host is not allowed'
  }
}

export class ImageResizingDto {
  @IsUrl({
    require_protocol: true
  })
  @Validate(IsAllowedImageUrlConstraint)
  url: string

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsOptional()
  w?: number

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsOptional()
  h?: number
}

export class ExportSubmissionsDto {
  @IsString()
  formId: string

  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx'
}

export class ExportProjectReportDto {
  @IsString()
  projectId: string

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string

  @IsOptional()
  @IsIn(['xlsx'])
  format?: 'xlsx'
}
