If you need to login with the aws cli, use the access keys in aws-access-keys.csv and `aws configure`

Build a docker image locally.

Push it to aws with this command:
aws lightsail push-container-image --region Virginia --service-name canopy-dev-site --label canopy-node --image canopy-node:latest