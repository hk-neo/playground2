@REQ_PLAYG-1980
Feature: SR-011 사용자 인터페이스 요구사항
	#웹 브라우저 기반 UI 제공. Chrome, Edge 최신 버전 지원. 반응형 레이아웃 및 직관적인 도구 접근성 제공.

	#매우 큰 용량의 Pixel Data를 포함한 DICOM 파일을 로드할 때, 메모리 부족 오류 없이 정상적으로 파싱을 완료하거나 정의된 제한 내에서 처리하는지 확인한다.
	@TEST_PLAYG-2529 @REQ_PLAYG-2365 @TESTSET_PLAYG-2476 @AI
	Scenario: 대용량 DICOM 파일 로드 안정성 확인
		Given 사용자가 DICOM 뷰어 시스템을 실행한 상태이고
		And 시스템이 처리 가능한 최대 메모리 임계값이 설정되어 있으며
		And 매우 큰 용량의 Pixel Data를 포함한 DICOM 파일이 준비되었을 때
		When 사용자가 해당 대용량 DICOM 파일을 시스템에 로드하면
		Then 시스템은 메모리 부족 오류 없이 파일 파싱을 완료하고
		And 정의된 제한 범위 내에서 의료 영상을 정상적으로 화면에 표시한다.
		
	#상태 변경이 발생한 시점부터 모든 구독자에게 통지가 완료되는 시점까지의 소요 시간을 측정하여, 요구사항인 16ms 이내에 처리가 완료되는지 확인한다.
	@TEST_PLAYG-2527 @REQ_PLAYG-2365 @TESTSET_PLAYG-2476 @AI
	Scenario: 상태 변경 통지 지연 시간(Latency) 측정
		Given 시스템에 다수의 구독자가 등록되어 있고
		And 특정 리소스의 상태 변경이 발생하기 직전이며
		When 시스템이 리소스의 상태를 변경하고 모든 구독자에게 통지를 전송하면
		Then 상태 변경 시점부터 마지막 구독자가 통지를 받기까지의 소요 시간이 16ms 이내임이 확인된다.
		
	#HTML 요소(img, script, iframe 등)의 src 속성을 이용한 외부 리소스 요청이 차단되어 로컬 전용 처리 원칙이 준수되는지 검증한다.
	@TEST_PLAYG-2520 @REQ_PLAYG-2365 @TESTSET_PLAYG-2476 @AI
	Scenario: 리소스 로딩을 통한 아웃바운드 통신 차단 검증
		Given 사용자가 시스템의 콘텐츠 작성 또는 편집 페이지에 접속해 있고
		And 외부 도메인을 가리키는 src 속성을 포함한 HTML 요소인 img, script 또는 iframe을 입력한 상태에서
		When 사용자가 해당 콘텐츠를 저장하거나 미리보기를 실행하여 리소스 로딩을 시도하면
		Then 시스템은 모든 외부 리소스에 대한 아웃바운드 통신 요청을 차단하고
		And 로컬 전용 처리 원칙에 따라 외부 데이터의 유입이 발생하지 않음을 보장한다
		
	#애플리케이션이 지원하는 주요 브라우저(Chrome, Firefox, Safari, Edge 등)에서 초기 로딩 및 기본 기능이 정상 작동하는지 확인한다.
	@TEST_PLAYG-2519 @REQ_PLAYG-2365 @TESTSET_PLAYG-2476 @AI
	Scenario: 브라우저 호환성 체크 기능 검증
		Given 사용자가 지원 대상 브라우저인 Chrome, Firefox, Safari 또는 Edge를 사용 중이며
		And 애플리케이션의 접속 URL이 준비된 상태에서
		When 사용자가 브라우저를 통해 애플리케이션에 접속하여 초기 로딩을 수행하면
		Then 시스템은 오류 없이 메인 화면을 표시하고
		And 모든 메뉴 클릭 및 버튼 활성화와 같은 기본 기능이 정상적으로 작동한다
		
	#환자 데이터 처리 후 브라우저의 LocalStorage 및 SessionStorage에 민감한 정보가 평문 또는 복구 가능한 형태로 남아있는지 검증한다.
	@TEST_PLAYG-2516 @REQ_PLAYG-2365 @TESTSET_PLAYG-2476 @AI
	Scenario: 브라우저 웹 스토리지 내 민감 데이터 잔존 여부 검증
		Given 사용자가 환자 데이터 처리 작업을 완료한 상태이고
		And 브라우저의 개발자 도구가 활성화되어 있으며
		When 사용자가 브라우저의 로컬 스토리지(LocalStorage)와 세션 스토리지(SessionStorage)를 확인하면
		Then 시스템은 어떠한 민감 정보도 평문 또는 복구 가능한 형태로 저장하지 않아야 한다.
		
