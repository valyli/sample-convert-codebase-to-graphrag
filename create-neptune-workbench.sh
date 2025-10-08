#!/bin/bash

# Neptune Workbench 创建脚本
# 这将创建一个SageMaker Notebook实例来访问Neptune

NEPTUNE_CLUSTER_ENDPOINT="code-graph-neptune-cluster.cluster-cwf02g4c6rbh.us-east-1.neptune.amazonaws.com"
NEPTUNE_PORT="8182"
SECURITY_GROUP_ID="sg-01e2b87d934eb4441"

# 获取VPC和子网信息
VPC_ID=$(aws ec2 describe-security-groups --group-ids $SECURITY_GROUP_ID --query "SecurityGroups[0].VpcId" --output text)
SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[0].SubnetId" --output text)

echo "创建Neptune Workbench..."
echo "VPC ID: $VPC_ID"
echo "Subnet ID: $SUBNET_ID"
echo "Security Group: $SECURITY_GROUP_ID"

# 创建IAM角色（如果不存在）
aws iam create-role --role-name NeptuneWorkbenchRole --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "sagemaker.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}' 2>/dev/null || echo "Role already exists"

# 附加必要的策略
aws iam attach-role-policy --role-name NeptuneWorkbenchRole --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerFullAccess
aws iam attach-role-policy --role-name NeptuneWorkbenchRole --policy-arn arn:aws:iam::aws:policy/NeptuneFullAccess

# 创建SageMaker Notebook实例
aws sagemaker create-notebook-instance \
  --notebook-instance-name "neptune-workbench-$(date +%s)" \
  --instance-type "ml.t3.medium" \
  --role-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/NeptuneWorkbenchRole" \
  --subnet-id "$SUBNET_ID" \
  --security-group-ids "$SECURITY_GROUP_ID" \
  --default-code-repository "https://github.com/aws/graph-notebook.git" \
  --additional-code-repositories "https://github.com/aws/graph-notebook.git"

echo "Neptune Workbench 创建中..."
echo "请在AWS控制台的SageMaker服务中查看Notebook实例状态"