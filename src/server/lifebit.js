
const axios = require('axios')
const config = require('config')

function LifeBitUtility(apikey) {
  const headers = {
    'Content-Type': 'application/json',
    apikey
  }

  const host = 'api.lifebit.ai/api/v1'

  this.startJob = ({ command, workflow, project, instanceType, parameters, executionPlatform = 'aws' }) => {
    const data = {
      command,
      workflow,
      project,
      instanceType,
      executionPlatform,
      parameters
    }
    return axios({
      method: 'post',
      url: `https://${host}/jobs`,
      headers,
      data
    }).then(response => response.data)
  }

  this.getJob = jobId => axios.get(`https://${host}/jobs/${jobId}`, { headers }).then(response => response.data)

  this.startSnpsJob = file => {
    const parameters = [
      {
        prefix: '',
        name: '',
        dataItemEmbedded: {
          type: 'S3File',
          data: {
            name: file.originalname,
            s3BucketName: file.bucket,
            s3ObjectKey: file.key,
            sizeInBytes: file.size
          }
        }
      }
    ]
    const data = {
      command: 'get_nutrition_snps.py',
      workflow: config.get('lifebit.workflow'),
      project: config.get('lifebit.project'),
      instanceType: config.get('lifebit.instanceType'),
      parameters
    }
    return this.startJob(data)
  }
}

module.exports = LifeBitUtility
