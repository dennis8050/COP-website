output "id" {
  value = aws_s3_bucket.this.id
}

output "arn" {
  value = aws_s3_bucket.this.arn
}

output "domain" {
  value = aws_s3_bucket.this.bucket_regional_domain_name
}

