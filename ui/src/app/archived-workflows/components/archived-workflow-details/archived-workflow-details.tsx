import {NotificationType, Page, SlidingPanel} from 'argo-ui';
import * as classNames from 'classnames';
import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import {Workflow} from '../../../../models';
import {uiUrl} from '../../../shared/base';
import {BasePage} from '../../../shared/components/base-page';
import {Loading} from '../../../shared/components/loading';
import {services} from '../../../shared/services';
import {
    WorkflowArtifacts,
    WorkflowDag,
    WorkflowLogsViewer,
    WorkflowNodeInfo,
    WorkflowParametersPanel,
    WorkflowSummaryPanel,
    WorkflowTimeline,
    WorkflowYamlViewer
} from '../../../workflows/components';

require('../../../workflows/components/workflow-details/workflow-details.scss');

interface State {
    workflow?: Workflow;
    error?: Error;
}

export class ArchivedWorkflowDetails extends BasePage<RouteComponentProps<any>, State> {
    private get namespace() {
        return this.props.match.params.namespace;
    }

    private get uid() {
        return this.props.match.params.uid;
    }

    private get tab() {
        return this.queryParam('tab') || 'workflow';
    }

    private set tab(tab) {
        this.setQueryParams({tab});
    }

    private get nodeId() {
        return this.queryParam('nodeId');
    }

    private set nodeId(nodeId) {
        this.setQueryParams({nodeId});
    }

    private get container() {
        return this.queryParam('container') || 'main';
    }

    private get sidePanel() {
        return this.queryParam('sidePanel');
    }

    private set sidePanel(sidePanel) {
        this.setQueryParams({sidePanel});
    }

    constructor(props: RouteComponentProps<any>, context: any) {
        super(props, context);
        this.state = {};
    }

    public componentDidMount(): void {
        services.archivedWorkflows
            .get(this.namespace, this.uid)
            .then(workflow => this.setState({workflow}))
            .catch(error => this.setState({error}));
    }

    public render() {
        if (this.state.error) {
            throw this.state.error;
        }
        return (
            <Page
                title='Archived Workflow Details'
                toolbar={{
                    actionMenu: {
                        items: [
                            {
                                title: 'Resubmit',
                                iconClassName: 'fa fa-redo',
                                action: () => this.resubmitArchivedWorkflow()
                            },
                            {
                                title: 'Delete',
                                iconClassName: 'fa fa-trash',
                                action: () => this.deleteArchivedWorkflow()
                            }
                        ]
                    },
                    breadcrumbs: [
                        {
                            title: 'Archived Workflows',
                            path: uiUrl('archived-workflows/')
                        },
                        {title: this.namespace + '/' + this.uid}
                    ],
                    tools: (
                        <div className='workflow-details__topbar-buttons'>
                            <a className={classNames({active: this.tab === 'summary'})} onClick={() => (this.tab = 'summary')}>
                                <i className='fa fa-columns' />
                            </a>
                            <a className={classNames({active: this.tab === 'timeline'})} onClick={() => (this.tab = 'timeline')}>
                                <i className='fa argo-icon-timeline' />
                            </a>
                            <a className={classNames({active: this.tab === 'workflow'})} onClick={() => (this.tab = 'workflow')}>
                                <i className='fa argo-icon-workflow' />
                            </a>
                        </div>
                    )
                }}>
                <div className={classNames('workflow-details', {'workflow-details--step-node-expanded': !!this.nodeId})}>{this.renderArchivedWorkflowDetails()}</div>
            </Page>
        );
    }

    private renderArchivedWorkflowDetails() {
        if (!this.state.workflow) {
            return <Loading />;
        }
        return (
            <>
                {this.tab === 'summary' ? (
                    <div className='argo-container'>
                        <div className='workflow-details__content'>
                            <WorkflowSummaryPanel workflow={this.state.workflow} />
                            {this.state.workflow.spec.arguments && this.state.workflow.spec.arguments.parameters && (
                                <React.Fragment>
                                    <h6>Parameters</h6>
                                    <WorkflowParametersPanel parameters={this.state.workflow.spec.arguments.parameters} />
                                </React.Fragment>
                            )}
                            <h6>Artifacts</h6>
                            <WorkflowArtifacts workflow={this.state.workflow} archived={true} />
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className='workflow-details__graph-container'>
                            {this.tab === 'workflow' ? (
                                <WorkflowDag workflow={this.state.workflow} selectedNodeId={this.nodeId} nodeClicked={node => (this.nodeId = node.id)} />
                            ) : (
                                <WorkflowTimeline workflow={this.state.workflow} selectedNodeId={this.nodeId} nodeClicked={node => (this.nodeId = node.id)} />
                            )}
                        </div>
                        {this.nodeId && (
                            <div className='workflow-details__step-info'>
                                <button className='workflow-details__step-info-close' onClick={() => (this.nodeId = null)}>
                                    <i className='argo-icon-close' />
                                </button>
                                <WorkflowNodeInfo
                                    node={this.node}
                                    workflow={this.state.workflow}
                                    onShowYaml={nodeId =>
                                        this.setQueryParams({
                                            sidePanel: 'yaml',
                                            nodeId
                                        })
                                    }
                                    onShowContainerLogs={(nodeId, container) =>
                                        this.setQueryParams({
                                            sidePanel: 'logs',
                                            nodeId,
                                            container
                                        })
                                    }
                                    archived={true}
                                />
                            </div>
                        )}
                    </div>
                )}
                <SlidingPanel isShown={!!this.sidePanel} onClose={() => (this.sidePanel = null)}>
                    {this.sidePanel === 'yaml' && <WorkflowYamlViewer workflow={this.state.workflow} selectedNode={this.node} />}
                    {this.sidePanel === 'logs' && <WorkflowLogsViewer workflow={this.state.workflow} nodeId={this.nodeId} container={this.container} archived={true} />}
                </SlidingPanel>
            </>
        );
    }

    private get node() {
        return this.nodeId && this.state.workflow.status.nodes[this.nodeId];
    }

    private resubmitArchivedWorkflow() {
        if (!confirm('Are you sure you want to re-submit this archived workflow?')) {
            return;
        }
        services.archivedWorkflows
            .resubmit(this.namespace, this.uid)
            .catch(e => {
                this.appContext.apis.notifications.show({
                    content: 'Failed to resubmit workflow ' + e,
                    type: NotificationType.Error
                });
            })
            .then((wf: Workflow) => {
                document.location.href = `/workflows/${wf.metadata.namespace}/${wf.metadata.name}`;
            });
    }

    private deleteArchivedWorkflow() {
        if (!confirm('Are you sure you want to delete this archived workflow?\nThere is no undo.')) {
            return;
        }
        services.archivedWorkflows
            .delete(this.namespace, this.uid)
            .catch(e => {
                this.appContext.apis.notifications.show({
                    content: 'Failed to delete archived workflow ' + e,
                    type: NotificationType.Error
                });
            })
            .then(() => {
                document.location.href = '/archived-workflows';
            });
    }
}
