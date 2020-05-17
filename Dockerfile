FROM lambci/lambda:build-nodejs10.x

ENV AWS_DEFAULT_REGION us-east-1
ENV AWS_LAMBDA_FUNCTION_NAME alexa-assistant-skill-function
ENV AWS_LAMBDA_FUNCTION_TIMEOUT 600

ARG NODE_TARGET=10.20.1

COPY . .

RUN rm -rf .git .idea node_modules
RUN npm install --only=prod
RUN npm rebuild --target=${NODE_TARGET} --target_arch=x64 --target_platform=linux --target_libc=glibc
RUN zip -9yr -@ lambda.zip < zip_files.txt

CMD aws lambda update-function-code --function-name ${AWS_LAMBDA_FUNCTION_NAME} --cli-connect-timeout 0 --zip-file fileb://lambda.zip
